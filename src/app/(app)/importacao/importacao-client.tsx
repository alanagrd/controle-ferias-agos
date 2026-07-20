"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  normName,
  parseAtivosGeralCsv,
  type LinhaAtivosGeral,
} from "@/lib/importacao";

type FuncionarioBasico = {
  id: string;
  codigo: string | null;
  nome: string;
  status: "ATIVO" | "INATIVO" | "REVISAR";
  empresa_id: string | null;
};

export default function ImportacaoClient({
  funcionarios,
  empresas,
}: {
  funcionarios: FuncionarioBasico[];
  empresas: { id: string; nome: string }[];
}) {
  const supabase = useMemo(() => createClient(), []);
  const [ativosGeral, setAtivosGeral] = useState<LinhaAtivosGeral[] | null>(
    null
  );
  const [fileName, setFileName] = useState("");
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [dbFuncionarios, setDbFuncionarios] = useState(funcionarios);

  const [selecionadosInativar, setSelecionadosInativar] = useState<Set<string>>(
    new Set()
  );
  const [selecionadosNovos, setSelecionadosNovos] = useState<Set<number>>(
    new Set()
  );
  const [applying, setApplying] = useState(false);
  const [resultado, setResultado] = useState<{
    inativados: number;
    criados: number;
  } | null>(null);

  const empresaByNome = useMemo(
    () =>
      Object.fromEntries(
        empresas.map((e) => [e.nome.toUpperCase(), e.id])
      ),
    [empresas]
  );

  async function handleFile(file: File) {
    setParsing(true);
    setParseError(null);
    setResultado(null);
    try {
      const buf = await file.arrayBuffer();
      const decoder = new TextDecoder("windows-1252");
      const text = decoder.decode(buf);
      const rows = parseAtivosGeralCsv(text);
      if (rows.length === 0) {
        setParseError(
          "Não encontrei nenhuma linha válida no arquivo. Confira se é o export 'Funcionários Ativos Geral' (;-delimitado)."
        );
        setAtivosGeral(null);
      } else {
        setAtivosGeral(rows);
        setFileName(file.name);
      }
    } catch {
      setParseError("Não consegui ler o arquivo. Confira o formato (CSV).");
    } finally {
      setParsing(false);
    }
  }

  const analise = useMemo(() => {
    if (!ativosGeral) return null;

    const codigosGeral = new Set(
      ativosGeral.filter((r) => r.codigo).map((r) => r.codigo)
    );
    const nomesGeral = new Set(ativosGeral.map((r) => r.nomeChave));

    const codigosDb = new Set(
      dbFuncionarios.filter((f) => f.codigo).map((f) => f.codigo as string)
    );
    const nomesDb = new Set(
      dbFuncionarios.map((f) => normName(f.nome, true))
    );

    const candidatosInativacao = dbFuncionarios.filter((f) => {
      if (f.status !== "ATIVO") return false;
      const porCodigo = f.codigo ? codigosGeral.has(f.codigo) : false;
      const porNome = nomesGeral.has(normName(f.nome, true));
      return !porCodigo && !porNome;
    });

    const novosACadastrar = ativosGeral.filter((r) => {
      const porCodigo = r.codigo ? codigosDb.has(r.codigo) : false;
      const porNome = nomesDb.has(r.nomeChave);
      return !porCodigo && !porNome;
    });

    return { candidatosInativacao, novosACadastrar };
  }, [ativosGeral, dbFuncionarios]);

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
        ? new Set(analise.novosACadastrar.map((_, i) => i))
        : new Set()
    );
  }

  // default: select everything once analysis is ready
  useMemo(() => {
    if (analise) {
      setSelecionadosInativar(new Set(analise.candidatosInativacao.map((f) => f.id)));
      setSelecionadosNovos(new Set(analise.novosACadastrar.map((_, i) => i)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ativosGeral]);

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

    const novos = analise.novosACadastrar.filter((_, i) =>
      selecionadosNovos.has(i)
    );
    let criados = 0;
    if (novos.length) {
      const payload = novos.map((r) => ({
        codigo: r.codigo || null,
        nome: r.nome,
        empresa_id: r.empresa ? empresaByNome[r.empresa] ?? null : null,
        obra: r.obra,
        cargo: r.cargo || null,
        admissao: r.admissao,
        status: "ATIVO" as const,
        cliente_codigo: r.clienteCodigo || null,
        cliente_razao_social: r.clienteRazaoSocial,
      }));
      const { error } = await supabase.from("rh_funcionarios").insert(payload);
      if (error) {
        alert("Erro ao cadastrar novos: " + error.message);
        setApplying(false);
        return;
      }
      criados = novos.length;
    }

    // refresh local state so the lists recompute without a full reload
    const { data: refreshed } = await supabase
      .from("rh_funcionarios")
      .select("id, codigo, nome, status, empresa_id");
    if (refreshed) setDbFuncionarios(refreshed);

    setResultado({ inativados, criados });
    setApplying(false);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">
          Importação mensal
        </h1>
        <p className="text-sm text-slate-500 max-w-2xl">
          Envie o export atualizado de &quot;Funcionários Ativos Geral&quot;
          (CSV, mesmo layout de sempre) para comparar com o cadastro atual.
          Nada é alterado no banco até você revisar e confirmar abaixo.
        </p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <label className="block text-sm font-medium text-slate-700 mb-2">
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
          <p className="text-sm text-slate-500 mt-2">Lendo arquivo...</p>
        )}
        {parseError && (
          <p className="text-sm text-red-600 mt-2">{parseError}</p>
        )}
        {ativosGeral && !parseError && (
          <p className="text-sm text-emerald-700 mt-2">
            {fileName}: {ativosGeral.length.toLocaleString("pt-BR")} funcionários
            lidos.
          </p>
        )}
      </div>

      {analise && (
        <>
          {resultado && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-sm text-emerald-800">
              Aplicado: {resultado.inativados} funcionário(s) inativado(s) e{" "}
              {resultado.criados} novo(s) cadastrado(s).
            </div>
          )}

          <Secao
            titulo="Candidatos a inativação"
            subtitulo="Estão como ATIVO no cadastro, mas não aparecem no arquivo enviado."
            total={analise.candidatosInativacao.length}
            onToggleAll={toggleAllInativar}
            allChecked={
              selecionadosInativar.size === analise.candidatosInativacao.length &&
              analise.candidatosInativacao.length > 0
            }
          >
            {analise.candidatosInativacao.length === 0 ? (
              <p className="text-sm text-slate-500 px-4 py-3">
                Nenhum candidato a inativação.
              </p>
            ) : (
              <table className="w-full text-sm">
                <tbody>
                  {analise.candidatosInativacao.map((f) => (
                    <tr key={f.id} className="border-t border-slate-100">
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
                      <td className="py-1.5 px-3 text-slate-500">
                        {f.codigo || "–"}
                      </td>
                      <td className="py-1.5 px-3 text-slate-900">{f.nome}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Secao>

          <Secao
            titulo="Novos a cadastrar"
            subtitulo="Estão ativos no arquivo enviado, mas ainda não existem no cadastro."
            total={analise.novosACadastrar.length}
            onToggleAll={toggleAllNovos}
            allChecked={
              selecionadosNovos.size === analise.novosACadastrar.length &&
              analise.novosACadastrar.length > 0
            }
          >
            {analise.novosACadastrar.length === 0 ? (
              <p className="text-sm text-slate-500 px-4 py-3">
                Nenhum funcionário novo identificado.
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-500 border-t border-slate-100">
                    <th className="py-1.5 px-3 font-medium"></th>
                    <th className="py-1.5 px-3 font-medium">Código</th>
                    <th className="py-1.5 px-3 font-medium">Nome</th>
                    <th className="py-1.5 px-3 font-medium">Empresa</th>
                    <th className="py-1.5 px-3 font-medium">Obra</th>
                    <th className="py-1.5 px-3 font-medium">Cargo</th>
                  </tr>
                </thead>
                <tbody>
                  {analise.novosACadastrar.map((r, i) => (
                    <tr key={i} className="border-t border-slate-100">
                      <td className="w-8 py-1.5 px-3">
                        <input
                          type="checkbox"
                          checked={selecionadosNovos.has(i)}
                          onChange={(e) => {
                            const next = new Set(selecionadosNovos);
                            if (e.target.checked) next.add(i);
                            else next.delete(i);
                            setSelecionadosNovos(next);
                          }}
                        />
                      </td>
                      <td className="py-1.5 px-3 text-slate-500">
                        {r.codigo || "–"}
                      </td>
                      <td className="py-1.5 px-3 text-slate-900">{r.nome}</td>
                      <td className="py-1.5 px-3">
                        {r.empresa || (
                          <span className="text-slate-400">
                            não identificada
                          </span>
                        )}
                      </td>
                      <td className="py-1.5 px-3 text-slate-500">
                        {r.obra || "–"}
                      </td>
                      <td className="py-1.5 px-3 text-slate-500">
                        {r.cargo || "–"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Secao>

          <div className="flex justify-end">
            <button
              onClick={aplicar}
              disabled={
                applying ||
                (selecionadosInativar.size === 0 && selecionadosNovos.size === 0)
              }
              className="bg-slate-900 text-white text-sm rounded-lg px-5 py-2 hover:bg-slate-800 disabled:opacity-50"
            >
              {applying
                ? "Aplicando..."
                : `Aplicar seleção (${selecionadosInativar.size} inativações, ${selecionadosNovos.size} novos)`}
            </button>
          </div>
        </>
      )}
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
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
        <div>
          <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
            {titulo}
            <span className="text-xs font-normal bg-slate-100 text-slate-600 rounded-full px-2 py-0.5">
              {total}
            </span>
          </h2>
          <p className="text-xs text-slate-500">{subtitulo}</p>
        </div>
        {total > 0 && (
          <label className="text-xs text-slate-500 flex items-center gap-1.5">
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
