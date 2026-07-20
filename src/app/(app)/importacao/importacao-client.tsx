"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  DIVERGENCIA_SIMILARITY_THRESHOLD,
  nameSimilarity,
  normName,
  parseFeriasCsv,
  splitEmpresaObra,
  type LinhaFerias,
} from "@/lib/importacao";

type FuncionarioBasico = {
  id: string;
  codigo: string | null;
  nome: string;
  status: "ATIVO" | "INATIVO" | "REVISAR";
  empresa_id: string | null;
  obra: string | null;
  setor: string | null;
  cargo: string | null;
  cliente_codigo: string | null;
  cliente_razao_social: string | null;
};

type PeriodoBasico = {
  id: string;
  funcionario_id: string;
  inicio: string;
  fim: string;
  dias_direito: number;
  data_limite: string;
};

function csvKey(r: LinhaFerias): string {
  return `${r.codigo}||${r.nomeChave}`;
}

function fmtDate(iso: string | null): string {
  if (!iso) return "–";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export default function ImportacaoClient({
  funcionarios,
  empresas,
  periodos,
}: {
  funcionarios: FuncionarioBasico[];
  empresas: { id: string; nome: string }[];
  periodos: PeriodoBasico[];
}) {
  const supabase = useMemo(() => createClient(), []);
  const [linhasFerias, setLinhasFerias] = useState<LinhaFerias[] | null>(
    null
  );
  const [fileName, setFileName] = useState("");
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [dbFuncionarios, setDbFuncionarios] = useState(funcionarios);
  const [dbPeriodos, setDbPeriodos] = useState(periodos);

  const [selecionadosInativar, setSelecionadosInativar] = useState<Set<string>>(
    new Set()
  );
  const [selecionadosNovos, setSelecionadosNovos] = useState<Set<string>>(
    new Set()
  );
  const [analisadoParaSelecao, setAnalisadoParaSelecao] = useState<
    LinhaFerias[] | null
  >(null);
  const [clienteEscolhido, setClienteEscolhido] = useState<
    Record<string, string>
  >({});
  const [applying, setApplying] = useState(false);
  const [resultado, setResultado] = useState<{
    inativados: number;
    criados: number;
    semCliente: number;
  } | null>(null);

  // divergências de grafia já resolvidas pelo usuário nesta sessão — ficam
  // excluídas permanentemente das listas/pareamento, mesmo após recomputar
  const [excludedDbIds, setExcludedDbIds] = useState<Set<string>>(new Set());
  const [excludedCsvKeys, setExcludedCsvKeys] = useState<Set<string>>(
    new Set()
  );
  const [resolvendoDivergencia, setResolvendoDivergencia] = useState<
    string | null
  >(null);

  // períodos já criados pelo usuário nesta sessão a partir do painel de
  // sincronização — saem da lista pendente assim que aplicados
  const [periodosResolvidos, setPeriodosResolvidos] = useState<Set<string>>(
    new Set()
  );
  const [aplicandoPeriodo, setAplicandoPeriodo] = useState<string | null>(
    null
  );

  const empresaByNome = useMemo(
    () =>
      Object.fromEntries(
        empresas.map((e) => [e.nome.toUpperCase(), e.id])
      ),
    [empresas]
  );

  const clientesConhecidos = useMemo(
    () =>
      Array.from(
        new Set(
          dbFuncionarios
            .map((f) => f.cliente_razao_social)
            .filter((c): c is string => !!c)
        )
      ).sort((a, b) => a.localeCompare(b, "pt-BR")),
    [dbFuncionarios]
  );

  async function handleFile(file: File) {
    setParsing(true);
    setParseError(null);
    setResultado(null);
    try {
      const buf = await file.arrayBuffer();
      const decoder = new TextDecoder("windows-1252");
      const text = decoder.decode(buf);
      const rows = parseFeriasCsv(text);
      if (rows.length === 0) {
        setParseError(
          "Não encontrei nenhuma linha válida no arquivo. Confira se é o export de Férias (;-delimitado)."
        );
        setLinhasFerias(null);
      } else {
        setLinhasFerias(rows);
        setFileName(file.name);
        setClienteEscolhido({});
      }
    } catch {
      setParseError("Não consegui ler o arquivo. Confira o formato (CSV).");
    } finally {
      setParsing(false);
    }
  }

  const analise = useMemo(() => {
    if (!linhasFerias) return null;

    const codigosGeral = new Set(
      linhasFerias.filter((r) => r.codigo).map((r) => r.codigo)
    );
    const nomesGeral = new Set(linhasFerias.map((r) => r.nomeChave));

    const codigosDb = new Set(
      dbFuncionarios.filter((f) => f.codigo).map((f) => f.codigo as string)
    );
    const nomesDb = new Set(
      dbFuncionarios.map((f) => normName(f.nome, true))
    );

    const candidatosInativacaoRaw = dbFuncionarios.filter((f) => {
      if (f.status !== "ATIVO") return false;
      if (excludedDbIds.has(f.id)) return false;
      const porCodigo = f.codigo ? codigosGeral.has(f.codigo) : false;
      const porNome = nomesGeral.has(normName(f.nome, true));
      return !porCodigo && !porNome;
    });

    const novosACadastrarRaw = linhasFerias.filter((r) => {
      if (excludedCsvKeys.has(csvKey(r))) return false;
      const porCodigo = r.codigo ? codigosDb.has(r.codigo) : false;
      const porNome = nomesDb.has(r.nomeChave);
      return !porCodigo && !porNome;
    });

    // ---- divergência de grafia: cruza os dois lados por similaridade de
    // nome (pareamento guloso 1-para-1, maior score primeiro)
    type Par = { fi: number; ri: number; score: number };
    const pares: Par[] = [];
    candidatosInativacaoRaw.forEach((f, fi) => {
      novosACadastrarRaw.forEach((r, ri) => {
        const score = nameSimilarity(f.nome, r.nome);
        if (score >= DIVERGENCIA_SIMILARITY_THRESHOLD) {
          pares.push({ fi, ri, score });
        }
      });
    });
    pares.sort((a, b) => b.score - a.score);

    const usedF = new Set<number>();
    const usedR = new Set<number>();
    const divergencias: {
      funcionario: FuncionarioBasico;
      linha: LinhaFerias;
      score: number;
    }[] = [];
    for (const p of pares) {
      if (usedF.has(p.fi) || usedR.has(p.ri)) continue;
      usedF.add(p.fi);
      usedR.add(p.ri);
      divergencias.push({
        funcionario: candidatosInativacaoRaw[p.fi],
        linha: novosACadastrarRaw[p.ri],
        score: p.score,
      });
    }

    const candidatosInativacao = candidatosInativacaoRaw.filter(
      (_, fi) => !usedF.has(fi)
    );
    const novosACadastrar = novosACadastrarRaw.filter(
      (_, ri) => !usedR.has(ri)
    );

    // ---- sincronização de período: para quem já existe no cadastro
    // (casado por código ou nome), compara o período informado na planilha
    // com os períodos já salvos — se o "início" não bate com nenhum
    // período existente, é um período novo/diferente que a planilha está
    // reportando e ainda não está no banco.
    const novosKeys = new Set(novosACadastrar.map((r) => csvKey(r)));
    const periodosAAtualizar: {
      funcionario: FuncionarioBasico;
      linha: LinhaFerias;
      periodoAtual: PeriodoBasico | null;
    }[] = [];
    linhasFerias.forEach((r) => {
      const key = csvKey(r);
      if (excludedCsvKeys.has(key)) return;
      if (periodosResolvidos.has(key)) return;
      if (novosKeys.has(key)) return; // já tratado como "novo a cadastrar"
      if (!r.periodoInicio) return;
      let funcionario = r.codigo
        ? dbFuncionarios.find((f) => f.codigo === r.codigo)
        : undefined;
      if (!funcionario) {
        funcionario = dbFuncionarios.find(
          (f) => normName(f.nome, true) === r.nomeChave
        );
      }
      if (!funcionario) return;
      if (excludedDbIds.has(funcionario.id)) return;
      const periodosDoFuncionario = dbPeriodos
        .filter((p) => p.funcionario_id === funcionario!.id)
        .sort((a, b) => (a.inicio < b.inicio ? 1 : -1));
      const jaTemEssePeriodo = periodosDoFuncionario.some(
        (p) => p.inicio === r.periodoInicio
      );
      if (jaTemEssePeriodo) return;
      periodosAAtualizar.push({
        funcionario,
        linha: r,
        periodoAtual: periodosDoFuncionario[0] ?? null,
      });
    });

    return {
      candidatosInativacao,
      novosACadastrar,
      divergencias,
      periodosAAtualizar,
    };
  }, [
    linhasFerias,
    dbFuncionarios,
    dbPeriodos,
    excludedDbIds,
    excludedCsvKeys,
    periodosResolvidos,
  ]);

  // colisões de nome entre clientes — independe do arquivo importado, é
  // apenas informativo sobre o cadastro atual
  const colisoes = useMemo(() => {
    const porNome = new Map<string, { nome: string; clientes: Set<string> }>();
    dbFuncionarios.forEach((f) => {
      if (!f.cliente_razao_social) return;
      const chave = normName(f.nome, true);
      if (!chave) return;
      const atual = porNome.get(chave) ?? {
        nome: f.nome,
        clientes: new Set<string>(),
      };
      atual.clientes.add(f.cliente_razao_social);
      porNome.set(chave, atual);
    });
    return Array.from(porNome.values())
      .filter((v) => v.clientes.size > 1)
      .map((v) => ({ nome: v.nome, clientes: Array.from(v.clientes).sort() }))
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  }, [dbFuncionarios]);

  function toggleAllInativar(checked: boolean) {
    if (!analise) return;
    setSelecionadosInativar(
      checked ? new Set(analise.candidatosInativacao.map((f) => f.id)) : new Set()
    );
  }

  function toggleAllNovos(checked: boolean) {
    if (!analise) return;
    setSelecionadosNovos(
      checked
        ? new Set(analise.novosACadastrar.map((r) => csvKey(r)))
        : new Set()
    );
  }

  // default: select everything once a new file is analyzed. Adjusting state
  // during render (guarded by comparing against the last seen linhasFerias)
  // instead of in an effect, per React's "adjusting state when a prop
  // changes" pattern.
  if (linhasFerias !== analisadoParaSelecao) {
    setAnalisadoParaSelecao(linhasFerias);
    if (analise) {
      setSelecionadosInativar(new Set(analise.candidatosInativacao.map((f) => f.id)));
      setSelecionadosNovos(
        new Set(analise.novosACadastrar.map((r) => csvKey(r)))
      );
    } else {
      setSelecionadosInativar(new Set());
      setSelecionadosNovos(new Set());
    }
  }

  async function resolverDivergenciaMesmaPessoa(funcionarioId: string, linha: LinhaFerias) {
    setResolvendoDivergencia(funcionarioId);
    setExcludedDbIds((prev) => new Set(prev).add(funcionarioId));
    setExcludedCsvKeys((prev) => new Set(prev).add(csvKey(linha)));
    setResolvendoDivergencia(null);
  }

  async function resolverDivergenciaInativar(funcionarioId: string, linha: LinhaFerias) {
    setResolvendoDivergencia(funcionarioId);
    const { error } = await supabase
      .from("rh_funcionarios")
      .update({ status: "INATIVO" })
      .eq("id", funcionarioId);
    if (error) {
      alert("Erro ao inativar: " + error.message);
      setResolvendoDivergencia(null);
      return;
    }
    setDbFuncionarios((prev) =>
      prev.map((f) =>
        f.id === funcionarioId ? { ...f, status: "INATIVO" as const } : f
      )
    );
    setExcludedDbIds((prev) => new Set(prev).add(funcionarioId));
    setExcludedCsvKeys((prev) => new Set(prev).add(csvKey(linha)));
    setResolvendoDivergencia(null);
  }

  async function aplicarPeriodo(funcionarioId: string, linha: LinhaFerias) {
    const key = csvKey(linha);
    setAplicandoPeriodo(key);
    const { data, error } = await supabase
      .from("rh_periodos_aquisitivos")
      .insert({
        funcionario_id: funcionarioId,
        inicio: linha.periodoInicio,
        fim: linha.periodoFim,
        dias_direito: 30,
        data_limite: linha.dataLimite,
      })
      .select()
      .single();
    if (error) {
      alert("Erro ao criar período: " + error.message);
      setAplicandoPeriodo(null);
      return;
    }
    if (data) {
      setDbPeriodos((prev) => [...prev, data as PeriodoBasico]);
    }
    setPeriodosResolvidos((prev) => new Set(prev).add(key));
    setAplicandoPeriodo(null);
  }

  async function aplicar() {
    if (!analise) return;
    setApplying(true);
    setResultado(null);

    const idsInativar = Array.from(selecionadosInativar);
    let inativados = 0;
    if (idsInativar.length) {
      const { error } = await supabase
        .from("rh_funcionarios")
        .update({ status: "INATIVO" })
        .in("id", idsInativar);
      if (error) {
        alert("Erro ao inativar: " + error.message);
        setApplying(false);
        return;
      }
      inativados = idsInativar.length;
    }

    const novosIncluidos = analise.novosACadastrar.filter((r) =>
      selecionadosNovos.has(csvKey(r))
    );
    let criados = 0;
    let semCliente = 0;
    const payload: {
      codigo: string | null;
      nome: string;
      empresa_id: string | null;
      obra: string | null;
      cargo: string | null;
      admissao: string | null;
      status: "ATIVO";
      cliente_codigo: string | null;
      cliente_razao_social: string;
    }[] = [];
    const linhasPayload: LinhaFerias[] = [];
    for (const r of novosIncluidos) {
      const clienteFinal = clienteEscolhido[csvKey(r)] || r.clienteRaw;
      if (!clienteFinal) {
        semCliente++;
        continue; // fica pendente até escolherem o cliente
      }
      const { empresa } = splitEmpresaObra(clienteFinal);
      payload.push({
        codigo: r.codigo || null,
        nome: r.nome,
        empresa_id: empresaByNome[empresa] ?? null,
        obra: r.obra,
        cargo: r.cargo || null,
        admissao: r.admissao,
        status: "ATIVO",
        cliente_codigo: null,
        cliente_razao_social: clienteFinal,
      });
      linhasPayload.push(r);
    }
    if (payload.length) {
      const { data: inseridos, error } = await supabase
        .from("rh_funcionarios")
        .insert(payload)
        .select("id");
      if (error) {
        alert("Erro ao cadastrar novos: " + error.message);
        setApplying(false);
        return;
      }
      criados = payload.length;

      // novos funcionários já chegam com o período aquisitivo informado
      // pela planilha, não vazio
      if (inseridos) {
        const periodosPayload = inseridos
          .map((f, idx) => {
            const r = linhasPayload[idx];
            if (!r || !r.periodoInicio || !r.periodoFim || !r.dataLimite) {
              return null;
            }
            return {
              funcionario_id: f.id as string,
              inicio: r.periodoInicio,
              fim: r.periodoFim,
              dias_direito: 30,
              data_limite: r.dataLimite,
            };
          })
          .filter((p): p is NonNullable<typeof p> => p !== null);
        if (periodosPayload.length) {
          const { error: periodoError } = await supabase
            .from("rh_periodos_aquisitivos")
            .insert(periodosPayload);
          if (periodoError) {
            alert(
              "Funcionários cadastrados, mas houve erro ao criar os períodos: " +
                periodoError.message
            );
          }
        }
      }
    }

    // refresh local state so the lists recompute without a full reload
    const [{ data: refreshedFuncionarios }, { data: refreshedPeriodos }] =
      await Promise.all([
        supabase
          .from("rh_funcionarios")
          .select(
            "id, codigo, nome, status, empresa_id, obra, setor, cargo, cliente_codigo, cliente_razao_social"
          ),
        supabase
          .from("rh_periodos_aquisitivos")
          .select("id, funcionario_id, inicio, fim, dias_direito, data_limite"),
      ]);
    if (refreshedFuncionarios) setDbFuncionarios(refreshedFuncionarios);
    if (refreshedPeriodos) setDbPeriodos(refreshedPeriodos);

    setResultado({ inativados, criados, semCliente });
    setApplying(false);
  }

  const ativosConfirmados = dbFuncionarios.filter(
    (f) => f.status === "ATIVO"
  ).length;

  const nadaPendente =
    !!analise &&
    analise.candidatosInativacao.length === 0 &&
    analise.novosACadastrar.length === 0 &&
    analise.periodosAAtualizar.length === 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
          Importação mensal
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 max-w-2xl">
          Envie o export mensal de Férias (mesmo layout de sempre) para
          comparar com o cadastro atual. Nada é alterado no banco até você
          revisar e confirmar abaixo.
        </p>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5">
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
          Arquivo CSV
        </label>
        <input
          type="file"
          accept=".csv"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
          }}
          className="text-sm"
        />
        {parsing && (
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">Lendo arquivo...</p>
        )}
        {parseError && (
          <p className="text-sm text-red-600 dark:text-red-400 mt-2">{parseError}</p>
        )}
        {linhasFerias && !parseError && (
          <p className="text-sm text-emerald-700 dark:text-emerald-400 mt-2">
            {fileName}: {linhasFerias.length.toLocaleString("pt-BR")} funcionários
            lidos.
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <Kpi
          label="Confirmados ativos"
          value={ativosConfirmados}
          tone="ok"
        />
        <Kpi
          label="A dispensar (não estão na planilha)"
          value={analise ? analise.candidatosInativacao.length : "–"}
          tone="danger"
        />
        <Kpi
          label="Divergência de grafia (revisar)"
          value={analise ? analise.divergencias.length : "–"}
          tone="warn"
        />
        <Kpi
          label="Novos a cadastrar (com período)"
          value={analise ? analise.novosACadastrar.length : "–"}
          tone="neutral"
        />
        <Kpi
          label="Períodos a atualizar"
          value={analise ? analise.periodosAAtualizar.length : "–"}
          tone="warn"
        />
      </div>

      {analise && (
        <>
          {resultado && (
            <div className="bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-900 rounded-xl p-4 text-sm text-emerald-800 dark:text-emerald-300">
              Aplicado: {resultado.inativados} funcionário(s) inativado(s) e{" "}
              {resultado.criados} novo(s) cadastrado(s).
              {resultado.semCliente > 0 && (
                <>
                  {" "}
                  {resultado.semCliente} ainda aguardam a escolha do cliente
                  antes de cadastrar (selecione e confirme de novo).
                </>
              )}
            </div>
          )}

          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Divergência de grafia — resolva antes de confirmar
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Nome parecido encontrado na planilha, mas grafado de forma
                diferente. Decida se é a mesma pessoa (mantém ativo, sem
                alterar cadastro) ou se deve ser tratado como desligamento.
              </p>
            </div>
            <div className="max-h-80 overflow-y-auto">
              {analise.divergencias.length === 0 ? (
                <p className="text-sm text-slate-500 dark:text-slate-400 px-4 py-3">
                  Nenhuma divergência pendente.
                </p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800">
                      <th className="py-1.5 px-3 font-medium">Cadastrado como</th>
                      <th className="py-1.5 px-3 font-medium">Cliente</th>
                      <th className="py-1.5 px-3 font-medium">
                        Encontrado na planilha como
                      </th>
                      <th className="py-1.5 px-3 font-medium">Ação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analise.divergencias.map((d) => {
                      const resolvendo =
                        resolvendoDivergencia === d.funcionario.id;
                      return (
                        <tr
                          key={d.funcionario.id}
                          className="border-t border-slate-100 dark:border-slate-800"
                        >
                          <td className="py-1.5 px-3 text-slate-900 dark:text-slate-100">
                            {d.funcionario.nome}
                          </td>
                          <td className="py-1.5 px-3 text-slate-700 dark:text-slate-300">
                            {d.funcionario.cliente_razao_social || "–"}
                          </td>
                          <td className="py-1.5 px-3 text-slate-900 dark:text-slate-100">
                            {d.linha.nome}
                          </td>
                          <td className="py-1.5 px-3">
                            <div className="flex gap-2">
                              <button
                                disabled={resolvendo}
                                onClick={() =>
                                  resolverDivergenciaMesmaPessoa(
                                    d.funcionario.id,
                                    d.linha
                                  )
                                }
                                className="text-xs rounded-lg border border-slate-300 dark:border-slate-700 px-2 py-1 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50"
                              >
                                É a mesma pessoa
                              </button>
                              <button
                                disabled={resolvendo}
                                onClick={() =>
                                  resolverDivergenciaInativar(
                                    d.funcionario.id,
                                    d.linha
                                  )
                                }
                                className="text-xs rounded-lg border border-slate-300 dark:border-slate-700 px-2 py-1 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50"
                              >
                                Inativar mesmo assim
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Períodos a atualizar
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-3xl">
                Funcionário já cadastrado, mas a planilha traz um período
                aquisitivo com início diferente de tudo que já está no
                sistema para ele. Confirme um por vez — isso não apaga nem
                altera períodos existentes, só adiciona o novo.
              </p>
            </div>
            <div className="max-h-96 overflow-y-auto">
              {analise.periodosAAtualizar.length === 0 ? (
                <p className="text-sm text-slate-500 dark:text-slate-400 px-4 py-3">
                  Nenhum período pendente de atualização.
                </p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800">
                      <th className="py-1.5 px-3 font-medium">Nome</th>
                      <th className="py-1.5 px-3 font-medium">Cliente</th>
                      <th className="py-1.5 px-3 font-medium">
                        Período atual no sistema
                      </th>
                      <th className="py-1.5 px-3 font-medium">
                        Período informado na planilha
                      </th>
                      <th className="py-1.5 px-3 font-medium">Ação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analise.periodosAAtualizar.map((p) => {
                      const key = csvKey(p.linha);
                      const aplicando = aplicandoPeriodo === key;
                      return (
                        <tr
                          key={key}
                          className="border-t border-slate-100 dark:border-slate-800"
                        >
                          <td className="py-1.5 px-3 text-slate-900 dark:text-slate-100">
                            {p.funcionario.nome}
                          </td>
                          <td className="py-1.5 px-3 text-slate-700 dark:text-slate-300">
                            {p.funcionario.cliente_razao_social || "–"}
                          </td>
                          <td className="py-1.5 px-3 text-slate-500 dark:text-slate-400">
                            {p.periodoAtual
                              ? `${fmtDate(p.periodoAtual.inicio)} – ${fmtDate(p.periodoAtual.fim)}`
                              : "nenhum"}
                          </td>
                          <td className="py-1.5 px-3 text-slate-900 dark:text-slate-100">
                            {fmtDate(p.linha.periodoInicio)} –{" "}
                            {fmtDate(p.linha.periodoFim)}
                            <span className="text-slate-400 dark:text-slate-500">
                              {" "}
                              (limite {fmtDate(p.linha.dataLimite)})
                            </span>
                          </td>
                          <td className="py-1.5 px-3">
                            <button
                              disabled={aplicando}
                              onClick={() =>
                                aplicarPeriodo(p.funcionario.id, p.linha)
                              }
                              className="text-xs rounded-lg border border-slate-300 dark:border-slate-700 px-2 py-1 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50"
                            >
                              {aplicando ? "Criando..." : "Criar este período"}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          <Secao
            titulo="Candidatos a inativação"
            subtitulo="Estão como ATIVO no cadastro, mas não aparecem na planilha enviada."
            total={analise.candidatosInativacao.length}
            onToggleAll={toggleAllInativar}
            allChecked={
              selecionadosInativar.size === analise.candidatosInativacao.length &&
              analise.candidatosInativacao.length > 0
            }
          >
            {analise.candidatosInativacao.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400 px-4 py-3">
                Nenhum candidato a inativação.
              </p>
            ) : (
              <table className="w-full text-sm">
                <tbody>
                  {analise.candidatosInativacao.map((f) => (
                    <tr key={f.id} className="border-t border-slate-100 dark:border-slate-800">
                      <td className="w-8 py-1.5 px-3">
                        <input
                          type="checkbox"
                          checked={selecionadosInativar.has(f.id)}
                          onChange={(e) => {
                            const next = new Set(selecionadosInativar);
                            if (e.target.checked) next.add(f.id);
                            else next.delete(f.id);
                            setSelecionadosInativar(next);
                          }}
                        />
                      </td>
                      <td className="py-1.5 px-3 text-slate-900 dark:text-slate-100">{f.nome}</td>
                      <td className="py-1.5 px-3 text-slate-500 dark:text-slate-400">
                        {f.cliente_razao_social || "–"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Secao>

          <Secao
            titulo="Novos a cadastrar"
            subtitulo="O cliente já vem identificado automaticamente pela própria planilha de Férias. Só é preciso escolher manualmente quando aparecer 'Selecionar...' (quem ficar sem cliente continua pendente para a próxima rodada). O período aquisitivo informado é criado junto, no mesmo passo."
            total={analise.novosACadastrar.length}
            onToggleAll={toggleAllNovos}
            allChecked={
              selecionadosNovos.size === analise.novosACadastrar.length &&
              analise.novosACadastrar.length > 0
            }
          >
            {analise.novosACadastrar.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400 px-4 py-3">
                Nenhum funcionário novo identificado.
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800">
                    <th className="py-1.5 px-3 font-medium"></th>
                    <th className="py-1.5 px-3 font-medium">Nome</th>
                    <th className="py-1.5 px-3 font-medium">Código</th>
                    <th className="py-1.5 px-3 font-medium">Cargo</th>
                    <th className="py-1.5 px-3 font-medium">Admissão</th>
                    <th className="py-1.5 px-3 font-medium">Período aquisitivo</th>
                    <th className="py-1.5 px-3 font-medium">Obra</th>
                    <th className="py-1.5 px-3 font-medium">Cliente</th>
                  </tr>
                </thead>
                <tbody>
                  {analise.novosACadastrar.map((r) => {
                    const key = csvKey(r);
                    const valorSelect = clienteEscolhido[key] ?? r.clienteRaw ?? "";
                    return (
                      <tr key={key} className="border-t border-slate-100 dark:border-slate-800">
                        <td className="w-8 py-1.5 px-3">
                          <input
                            type="checkbox"
                            checked={selecionadosNovos.has(key)}
                            onChange={(e) => {
                              const next = new Set(selecionadosNovos);
                              if (e.target.checked) next.add(key);
                              else next.delete(key);
                              setSelecionadosNovos(next);
                            }}
                          />
                        </td>
                        <td className="py-1.5 px-3 text-slate-900 dark:text-slate-100">
                          {r.nome}
                        </td>
                        <td className="py-1.5 px-3 text-slate-500 dark:text-slate-400">
                          {r.codigo || "–"}
                        </td>
                        <td className="py-1.5 px-3 text-slate-500 dark:text-slate-400">
                          {r.cargo || "–"}
                        </td>
                        <td className="py-1.5 px-3 text-slate-500 dark:text-slate-400">
                          {fmtDate(r.admissao)}
                        </td>
                        <td className="py-1.5 px-3 text-slate-500 dark:text-slate-400">
                          {fmtDate(r.periodoInicio)} – {fmtDate(r.periodoFim)}
                        </td>
                        <td className="py-1.5 px-3 text-slate-500 dark:text-slate-400">
                          {r.obra || "–"}
                        </td>
                        <td className="py-1.5 px-3">
                          <select
                            value={valorSelect}
                            onChange={(e) =>
                              setClienteEscolhido((prev) => ({
                                ...prev,
                                [key]: e.target.value,
                              }))
                            }
                            className="text-xs border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 rounded-lg px-2 py-1 min-w-[140px]"
                          >
                            <option value="">Selecionar...</option>
                            {clientesConhecidos.map((c) => (
                              <option key={c} value={c}>
                                {c}
                              </option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </Secao>

          <div className="flex items-center justify-end gap-4 flex-wrap">
            {nadaPendente && (
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Nada pendente para aplicar — todos os itens já foram tratados.
              </span>
            )}
            <button
              onClick={aplicar}
              disabled={
                applying ||
                (selecionadosInativar.size === 0 && selecionadosNovos.size === 0)
              }
              className="bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-sm rounded-lg px-5 py-2 hover:bg-slate-800 dark:hover:bg-white disabled:opacity-50"
            >
              {applying
                ? "Aplicando..."
                : `Confirmar importação deste mês (${selecionadosInativar.size} inativações, ${selecionadosNovos.size} novos)`}
            </button>
          </div>
        </>
      )}

      {colisoes.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              Nomes iguais em mais de um cliente
              <span className="text-xs font-normal text-slate-400 dark:text-slate-500">
                (apenas informativo)
              </span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-3xl">
              Ao juntar as planilhas dos clientes, encontrei nomes idênticos
              cadastrados em mais de uma empresa do grupo. Pode ser a mesma
              pessoa que migrou de obra/cliente, ou coincidência de nome —
              vale confirmar na importação real, porque o cruzamento com o
              histórico de pagamento é feito só pelo nome e pode juntar
              lançamentos no cadastro errado quando isso acontece.
            </p>
          </div>
          <div className="max-h-56 overflow-y-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800">
                  <th className="py-1.5 px-3 font-medium">Nome</th>
                  <th className="py-1.5 px-3 font-medium">Clientes onde aparece</th>
                </tr>
              </thead>
              <tbody>
                {colisoes.map((c) => (
                  <tr key={c.nome} className="border-t border-slate-100 dark:border-slate-800">
                    <td className="py-1.5 px-3 text-slate-900 dark:text-slate-100">{c.nome}</td>
                    <td className="py-1.5 px-3 text-slate-700 dark:text-slate-300">
                      {c.clientes.join(" e ")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function Kpi({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | string;
  tone: "ok" | "danger" | "warn" | "neutral";
}) {
  const toneClasses: Record<typeof tone, string> = {
    ok: "text-emerald-700 dark:text-emerald-400",
    danger: "text-red-600 dark:text-red-400",
    warn: "text-amber-600 dark:text-amber-400",
    neutral: "text-slate-900 dark:text-slate-100",
  };
  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4">
      <div className="text-xs text-slate-500 dark:text-slate-400">{label}</div>
      <div className={`text-2xl font-semibold mt-1 ${toneClasses[tone]}`}>
        {value}
      </div>
    </div>
  );
}

function Secao({
  titulo,
  subtitulo,
  total,
  children,
  onToggleAll,
  allChecked,
}: {
  titulo: string;
  subtitulo: string;
  total: number;
  children: React.ReactNode;
  onToggleAll: (checked: boolean) => void;
  allChecked: boolean;
}) {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800">
        <div>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            {titulo}
            <span className="text-xs font-normal bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-full px-2 py-0.5">
              {total}
            </span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">{subtitulo}</p>
        </div>
        {total > 0 && (
          <label className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={allChecked}
              onChange={(e) => onToggleAll(e.target.checked)}
            />
            selecionar todos
          </label>
        )}
      </div>
      <div className="max-h-96 overflow-y-auto">{children}</div>
    </div>
  );
}
