"use client";

import { useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Competencia, Funcionario, FuncionarioCompetencia } from "@/lib/types";
import { nomeCompetencia } from "@/lib/status-vt";
import { parseApontamentoXlsx, type LinhaApontamento } from "@/lib/importacao-vt";
import { parseAtivosVtFile, type LinhaAtivoVt } from "@/lib/importacao-ativos-vt";
import {
  gerarLinhasCsvBitti,
  baixarCsvBitti,
  tipoEvento,
  type LinhaEventoBitti,
  type ResumoEvento,
} from "@/lib/export-bitti";

type FuncionarioLite = Pick<
  Funcionario,
  "id" | "codigo" | "nome" | "obra" | "status" | "cliente_razao_social"
>;

type FuncCompLite = Pick<
  FuncionarioCompetencia,
  | "id"
  | "funcionario_id"
  | "competencia_id"
  | "obra_snapshot"
  | "status_no_mes"
  | "valor_diario"
  | "valor_total"
  | "vr_valor"
>;

export default function VtImportacaoClient({
  competenciaAtual,
  funcComp,
  funcionarios,
}: {
  competenciaAtual: Competencia | null;
  funcComp: FuncCompLite[];
  funcionarios: FuncionarioLite[];
}) {
  const [tab, setTab] = useState<"ativos" | "apontamento" | "bitti">("ativos");

  if (!competenciaAtual) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-8 text-center">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Abra a competência do mês em Funcionários & VT antes de importar.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
          Importação
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          {nomeCompetencia(competenciaAtual.ano, competenciaAtual.mes)}
        </p>
      </div>

      <div className="flex gap-1 border-b border-slate-200 dark:border-slate-800">
        <button
          onClick={() => setTab("ativos")}
          className={
            tab === "ativos"
              ? "px-3.5 py-2 text-sm font-semibold text-slate-900 dark:text-slate-100 border-b-2 border-agos-green"
              : "px-3.5 py-2 text-sm font-medium text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
          }
        >
          Ativos (admissões, dispensas e transferências)
        </button>
        <button
          onClick={() => setTab("apontamento")}
          className={
            tab === "apontamento"
              ? "px-3.5 py-2 text-sm font-semibold text-slate-900 dark:text-slate-100 border-b-2 border-agos-green"
              : "px-3.5 py-2 text-sm font-medium text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
          }
        >
          Apontamento
        </button>
        <button
          onClick={() => setTab("bitti")}
          className={
            tab === "bitti"
              ? "px-3.5 py-2 text-sm font-semibold text-slate-900 dark:text-slate-100 border-b-2 border-agos-green"
              : "px-3.5 py-2 text-sm font-medium text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
          }
        >
          Exportar Bitti
        </button>
      </div>

      {tab === "ativos" ? (
        <ConciliacaoAtivosTab
          competenciaAtual={competenciaAtual}
          funcComp={funcComp}
          funcionarios={funcionarios}
        />
      ) : tab === "apontamento" ? (
        <ApontamentoTab
          competenciaAtual={competenciaAtual}
          funcComp={funcComp}
          funcionarios={funcionarios}
        />
      ) : (
        <ExportarBittiTab
          competenciaAtual={competenciaAtual}
          funcComp={funcComp}
          funcionarios={funcionarios}
        />
      )}
    </div>
  );
}

// ------------------------------------------------------------------------
// Aba: Ativos — conciliação de headcount + centro de custo
// ------------------------------------------------------------------------

type ItemNovo = {
  linha: LinhaAtivoVt;
  funcionario: FuncionarioLite | null; // null = precisa cadastrar em rh_funcionarios também
};

type ItemDispensado = {
  fc: FuncCompLite;
  funcionario: FuncionarioLite | undefined;
};

type ItemTransferencia = {
  linha: LinhaAtivoVt;
  fc: FuncCompLite;
  funcionario: FuncionarioLite;
};

const CCUSTO_AFASTADO = /^AFASTAD/;

function ConciliacaoAtivosTab({
  competenciaAtual,
  funcComp,
  funcionarios,
}: {
  competenciaAtual: Competencia;
  funcComp: FuncCompLite[];
  funcionarios: FuncionarioLite[];
}) {
  const supabase = useMemo(() => createClient(), []);
  const inputRef = useRef<HTMLInputElement>(null);

  const [, setFileName] = useState<string | null>(null);
  const [avisos, setAvisos] = useState<string[]>([]);
  const [linhasArquivo, setLinhasArquivo] = useState<LinhaAtivoVt[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [applyingNovos, setApplyingNovos] = useState(false);
  const [applyingDispensados, setApplyingDispensados] = useState(false);
  const [applyingTransferencias, setApplyingTransferencias] = useState(false);
  const [resultado, setResultado] = useState<string | null>(null);
  const [novosAplicados, setNovosAplicados] = useState<Set<string>>(new Set());
  const [dispensadosAplicados, setDispensadosAplicados] = useState<Set<string>>(
    new Set()
  );
  const [transferenciasAplicadas, setTransferenciasAplicadas] = useState<
    Set<string>
  >(new Set());

  const funcionariosPorCodigo = useMemo(() => {
    const map = new Map<string, FuncionarioLite>();
    funcionarios.forEach((f) => {
      if (f.codigo) map.set(f.codigo, f);
    });
    return map;
  }, [funcionarios]);

  const funcionariosPorId = useMemo(() => {
    const map = new Map<string, FuncionarioLite>();
    funcionarios.forEach((f) => map.set(f.id, f));
    return map;
  }, [funcionarios]);

  const funcCompPorFuncionarioId = useMemo(() => {
    const map = new Map<string, FuncCompLite>();
    funcComp.forEach((fc) => map.set(fc.funcionario_id, fc));
    return map;
  }, [funcComp]);

  async function handleFile(file: File) {
    setLoading(true);
    setResultado(null);
    setFileName(file.name);
    setNovosAplicados(new Set());
    setDispensadosAplicados(new Set());
    setTransferenciasAplicadas(new Set());

    const { linhas, avisos: avisosParser } = await parseAtivosVtFile(file);
    setLinhasArquivo(linhas);
    setAvisos(avisosParser);
    setLoading(false);
  }

  const { novos, dispensados, transferencias, obrasNoArquivo } = useMemo(() => {
    if (!linhasArquivo) {
      return {
        novos: [] as ItemNovo[],
        dispensados: [] as ItemDispensado[],
        transferencias: [] as ItemTransferencia[],
        obrasNoArquivo: new Set<string>(),
      };
    }

    const codigosNoArquivo = new Set(
      linhasArquivo.map((l) => l.codigo.padStart(6, "0"))
    );
    const obrasNoArquivo = new Set(
      linhasArquivo.map((l) => l.ccusto.trim()).filter(Boolean)
    );

    const novos: ItemNovo[] = [];
    const transferencias: ItemTransferencia[] = [];

    linhasArquivo.forEach((linha) => {
      const codigo6 = linha.codigo.padStart(6, "0");
      const funcionario = funcionariosPorCodigo.get(codigo6) ?? null;
      const fc = funcionario
        ? funcCompPorFuncionarioId.get(funcionario.id)
        : undefined;

      if (!fc || fc.status_no_mes !== "ATIVO") {
        novos.push({ linha, funcionario });
        return;
      }

      // já ativo na competência — checa transferência de centro de custo
      const ccusto = linha.ccusto.trim();
      if (
        ccusto &&
        !CCUSTO_AFASTADO.test(ccusto.toUpperCase()) &&
        ccusto !== (fc.obra_snapshot ?? "").trim()
      ) {
        transferencias.push({ linha, fc, funcionario: funcionario! });
      }
    });

    const dispensados: ItemDispensado[] = funcComp
      .filter((fc) => fc.status_no_mes === "ATIVO")
      .filter((fc) => {
        const funcionario = funcionariosPorId.get(fc.funcionario_id);
        const codigo = funcionario?.codigo;
        const obra = (fc.obra_snapshot ?? "").trim();
        return (
          obra &&
          obrasNoArquivo.has(obra) &&
          (!codigo || !codigosNoArquivo.has(codigo))
        );
      })
      .map((fc) => ({ fc, funcionario: funcionariosPorId.get(fc.funcionario_id) }));

    return { novos, dispensados, transferencias, obrasNoArquivo };
  }, [linhasArquivo, funcionariosPorCodigo, funcionariosPorId, funcCompPorFuncionarioId, funcComp]);

  async function aplicarNovo(item: ItemNovo, key: string) {
    let funcionarioId = item.funcionario?.id;

    if (!funcionarioId) {
      const { data: novo, error: errNovo } = await supabase
        .from("rh_funcionarios")
        .insert({
          nome: item.linha.nome,
          cliente_razao_social: item.linha.cliente,
          obra: item.linha.ccusto || null,
          cargo: item.linha.funcao || null,
          admissao: item.linha.admissao,
          status: "ATIVO",
        })
        .select("id")
        .single();
      if (errNovo || !novo) {
        setResultado(`Erro ao cadastrar ${item.linha.nome}: ${errNovo?.message}`);
        return;
      }
      funcionarioId = novo.id;
    }

    const { error: errFc } = await supabase
      .from("vt_funcionario_competencia")
      .upsert(
        {
          funcionario_id: funcionarioId,
          competencia_id: competenciaAtual.id,
          obra_snapshot: item.linha.ccusto || null,
          status_no_mes: "ATIVO",
          tipo_vt: "DIARIO",
        },
        { onConflict: "funcionario_id,competencia_id" }
      );

    if (errFc) {
      setResultado(`Erro ao adicionar ${item.linha.nome} à competência: ${errFc.message}`);
      return;
    }

    setNovosAplicados((prev) => new Set(prev).add(key));
  }

  async function aplicarTodosNovos() {
    setApplyingNovos(true);
    for (const item of novos) {
      const key = item.linha.codigo;
      if (!novosAplicados.has(key)) await aplicarNovo(item, key);
    }
    setApplyingNovos(false);
    setResultado(`${novos.length} admissão(ões)/readmissão(ões) aplicada(s).`);
  }

  async function aplicarDispensado(item: ItemDispensado) {
    const { error } = await supabase
      .from("vt_funcionario_competencia")
      .update({ status_no_mes: "DISPENSADO" })
      .eq("id", item.fc.id);
    if (error) {
      setResultado(`Erro ao marcar ${item.funcionario?.nome} como dispensado: ${error.message}`);
      return;
    }
    setDispensadosAplicados((prev) => new Set(prev).add(item.fc.id));
  }

  async function aplicarTodosDispensados() {
    setApplyingDispensados(true);
    for (const item of dispensados) {
      if (!dispensadosAplicados.has(item.fc.id)) await aplicarDispensado(item);
    }
    setApplyingDispensados(false);
    setResultado(`${dispensados.length} dispensa(s) aplicada(s) (só no VT desta competência).`);
  }

  async function aplicarTransferencia(item: ItemTransferencia) {
    const novaObra = item.linha.ccusto.trim();
    const [{ error: err1 }, { error: err2 }] = await Promise.all([
      supabase
        .from("vt_funcionario_competencia")
        .update({ obra_snapshot: novaObra })
        .eq("id", item.fc.id),
      supabase
        .from("rh_funcionarios")
        .update({
          obra: novaObra,
          cliente_razao_social: item.linha.cliente ?? item.funcionario.cliente_razao_social,
        })
        .eq("id", item.funcionario.id),
    ]);
    if (err1 || err2) {
      setResultado(
        `Erro ao transferir ${item.funcionario.nome}: ${err1?.message ?? err2?.message}`
      );
      return;
    }
    setTransferenciasAplicadas((prev) => new Set(prev).add(item.fc.id));
  }

  async function aplicarTodasTransferencias() {
    setApplyingTransferencias(true);
    for (const item of transferencias) {
      if (!transferenciasAplicadas.has(item.fc.id)) await aplicarTransferencia(item);
    }
    setApplyingTransferencias(false);
    setResultado(`${transferencias.length} transferência(s) de centro de custo aplicada(s).`);
  }

  return (
    <div className="space-y-4">
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const file = e.dataTransfer.files?.[0];
          if (file) handleFile(file);
        }}
        className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl p-10 text-center cursor-pointer hover:border-agos-green transition bg-white dark:bg-slate-900"
      >
        <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
          Arraste a planilha de ativos (CSV) ou clique para selecionar
        </p>
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
          Pode ser parcial (só alguns clientes/obras) — a conciliação só considera
          os centros de custo que aparecem no arquivo
        </p>
        <input
          ref={inputRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
        />
      </div>

      {loading && (
        <p className="text-sm text-slate-500 dark:text-slate-400">Lendo arquivo...</p>
      )}

      {avisos.length > 0 && (
        <div className="rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950 p-3 text-xs text-amber-700 dark:text-amber-400">
          {avisos.map((a, i) => (
            <p key={i}>{a}</p>
          ))}
        </div>
      )}

      {resultado && (
        <p className="text-sm text-agos-green-dark dark:text-agos-green-light">
          {resultado}
        </p>
      )}

      {linhasArquivo && (
        <>
          <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-2.5 text-xs text-slate-500 dark:text-slate-400">
            {linhasArquivo.length} linha(s) no arquivo · {obrasNoArquivo.size} centro(s) de
            custo cobertos por ele
          </div>

          <ConciliacaoSecao
            titulo="Admissões e readmissões"
            descricao="No arquivo, mas não estão ATIVO(a)s na competência atual — inclui gente nova e gente que voltou."
            total={novos.length}
            aplicados={novosAplicados.size}
            onAplicarTodos={aplicarTodosNovos}
            aplicandoTodos={applyingNovos}
            corTotal="text-agos-green-dark dark:text-agos-green-light"
          >
            {novos.map((item) => {
              const key = item.linha.codigo;
              const aplicado = novosAplicados.has(key);
              return (
                <tr
                  key={key}
                  className="border-b border-slate-50 dark:border-slate-800/60 last:border-0"
                >
                  <td className="py-2 px-3 font-mono text-xs text-slate-500">
                    {item.linha.codigo}
                  </td>
                  <td className="py-2 px-3 text-slate-700 dark:text-slate-300">
                    {item.linha.nome}
                  </td>
                  <td className="py-2 px-3 font-mono text-xs text-slate-500">
                    {item.linha.ccusto}
                  </td>
                  <td className="py-2 px-3 text-xs text-slate-400">
                    {item.funcionario
                      ? "Já existe no RH — só entra na competência"
                      : "Não existe no RH — será cadastrado"}
                  </td>
                  <td className="py-2 px-3 text-right">
                    {aplicado ? (
                      <span className="text-xs text-agos-green-dark dark:text-agos-green-light">
                        ✓ aplicado
                      </span>
                    ) : (
                      <button
                        onClick={() => aplicarNovo(item, key)}
                        className="text-xs font-semibold text-agos-green-dark dark:text-agos-green-light hover:underline"
                      >
                        Aplicar
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </ConciliacaoSecao>

          <ConciliacaoSecao
            titulo="Dispensados"
            descricao="Estavam ATIVO(a)s na competência mas sumiram do arquivo, dentro de um centro de custo que o arquivo cobre."
            total={dispensados.length}
            aplicados={dispensadosAplicados.size}
            onAplicarTodos={aplicarTodosDispensados}
            aplicandoTodos={applyingDispensados}
            corTotal="text-red-600 dark:text-red-400"
          >
            {dispensados.map((item) => {
              const aplicado = dispensadosAplicados.has(item.fc.id);
              return (
                <tr
                  key={item.fc.id}
                  className="border-b border-slate-50 dark:border-slate-800/60 last:border-0"
                >
                  <td className="py-2 px-3 font-mono text-xs text-slate-500">
                    {item.funcionario?.codigo ?? "—"}
                  </td>
                  <td className="py-2 px-3 text-slate-700 dark:text-slate-300">
                    {item.funcionario?.nome ?? "—"}
                  </td>
                  <td className="py-2 px-3 font-mono text-xs text-slate-500">
                    {item.fc.obra_snapshot}
                  </td>
                  <td className="py-2 px-3 text-xs text-slate-400">
                    Marca como dispensado só nesta competência do VT
                  </td>
                  <td className="py-2 px-3 text-right">
                    {aplicado ? (
                      <span className="text-xs text-agos-green-dark dark:text-agos-green-light">
                        ✓ aplicado
                      </span>
                    ) : (
                      <button
                        onClick={() => aplicarDispensado(item)}
                        className="text-xs font-semibold text-red-600 dark:text-red-400 hover:underline"
                      >
                        Aplicar
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </ConciliacaoSecao>

          <ConciliacaoSecao
            titulo="Transferências de centro de custo"
            descricao="Mesma matrícula, obra diferente da que está salva na competência."
            total={transferencias.length}
            aplicados={transferenciasAplicadas.size}
            onAplicarTodos={aplicarTodasTransferencias}
            aplicandoTodos={applyingTransferencias}
            corTotal="text-amber-600 dark:text-amber-400"
          >
            {transferencias.map((item) => {
              const aplicado = transferenciasAplicadas.has(item.fc.id);
              return (
                <tr
                  key={item.fc.id}
                  className="border-b border-slate-50 dark:border-slate-800/60 last:border-0"
                >
                  <td className="py-2 px-3 font-mono text-xs text-slate-500">
                    {item.funcionario.codigo}
                  </td>
                  <td className="py-2 px-3 text-slate-700 dark:text-slate-300">
                    {item.funcionario.nome}
                  </td>
                  <td className="py-2 px-3 text-xs">
                    <span className="font-mono text-slate-400 line-through">
                      {item.fc.obra_snapshot}
                    </span>
                    <span className="mx-1.5 text-slate-300">→</span>
                    <span className="font-mono text-slate-700 dark:text-slate-300">
                      {item.linha.ccusto}
                    </span>
                  </td>
                  <td className="py-2 px-3 text-right">
                    {aplicado ? (
                      <span className="text-xs text-agos-green-dark dark:text-agos-green-light">
                        ✓ aplicado
                      </span>
                    ) : (
                      <button
                        onClick={() => aplicarTransferencia(item)}
                        className="text-xs font-semibold text-amber-600 dark:text-amber-400 hover:underline"
                      >
                        Aplicar
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </ConciliacaoSecao>

          {novos.length === 0 && dispensados.length === 0 && transferencias.length === 0 && (
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 text-center text-sm text-slate-500 dark:text-slate-400">
              Nenhuma divergência encontrada — tudo bate com o arquivo.
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ConciliacaoSecao({
  titulo,
  descricao,
  total,
  aplicados,
  onAplicarTodos,
  aplicandoTodos,
  corTotal,
  children,
}: {
  titulo: string;
  descricao: string;
  total: number;
  aplicados: number;
  onAplicarTodos: () => void;
  aplicandoTodos: boolean;
  corTotal: string;
  children: React.ReactNode;
}) {
  if (total === 0) return null;
  const pendentes = total - aplicados;
  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800">
        <div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            {titulo} <span className={corTotal}>({total})</span>
          </h3>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{descricao}</p>
        </div>
        {pendentes > 0 && (
          <button
            onClick={onAplicarTodos}
            disabled={aplicandoTodos}
            className="bg-agos-green hover:bg-agos-green-dark text-white text-xs font-semibold rounded-lg px-3 py-1.5 disabled:opacity-60 whitespace-nowrap"
          >
            {aplicandoTodos ? "Aplicando..." : `Aplicar todos (${pendentes})`}
          </button>
        )}
      </div>
      <div className="max-h-72 overflow-y-auto">
        <table className="w-full text-sm">
          <tbody>{children}</tbody>
        </table>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------------
// Aba: Apontamento (já existia)
// ------------------------------------------------------------------------

type LinhaConciliada = {
  linha: LinhaApontamento;
  funcComp: FuncCompLite | null;
  funcionario: FuncionarioLite | null;
};

function ApontamentoTab({
  competenciaAtual,
  funcComp,
  funcionarios,
}: {
  competenciaAtual: Competencia;
  funcComp: FuncCompLite[];
  funcionarios: FuncionarioLite[];
}) {
  const supabase = useMemo(() => createClient(), []);
  const inputRef = useRef<HTMLInputElement>(null);

  const [obraSelecionada, setObraSelecionada] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [avisos, setAvisos] = useState<string[]>([]);
  const [linhasArquivo, setLinhasArquivo] = useState<LinhaApontamento[] | null>(
    null
  );
  const [colunasEncontradas, setColunasEncontradas] = useState<
    Partial<Record<keyof LinhaApontamento, boolean>>
  >({});
  const [abaLida, setAbaLida] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [resultado, setResultado] = useState<string | null>(null);

  const obras = useMemo(
    () =>
      Array.from(
        new Set(funcComp.map((fc) => (fc.obra_snapshot ?? "").trim()).filter(Boolean))
      ).sort((a, b) => a.localeCompare(b, "pt-BR")),
    [funcComp]
  );

  const funcionariosPorCodigo = useMemo(() => {
    const map = new Map<string, FuncionarioLite>();
    funcionarios.forEach((f) => {
      if (f.codigo) map.set(f.codigo, f);
    });
    return map;
  }, [funcionarios]);

  const funcCompPorFuncionarioId = useMemo(() => {
    const map = new Map<string, FuncCompLite>();
    funcComp.forEach((fc) => map.set(fc.funcionario_id, fc));
    return map;
  }, [funcComp]);

  async function handleFile(file: File) {
    setLoading(true);
    setResultado(null);
    setFileName(file.name);

    const {
      linhas,
      avisos: avisosParser,
      colunasEncontradas: cols,
      abaLida,
    } = await parseApontamentoXlsx(file, {
      ano: competenciaAtual.ano,
      mes: competenciaAtual.mes,
    });
    setLinhasArquivo(linhas);
    setAvisos(avisosParser);
    setColunasEncontradas(cols);
    setAbaLida(abaLida);
    setLoading(false);
  }

  const conciliadas = useMemo<LinhaConciliada[]>(() => {
    if (!linhasArquivo) return [];
    return linhasArquivo.map((linha) => {
      const codigo = linha.matricula.padStart(6, "0");
      const funcionario = funcionariosPorCodigo.get(codigo) ?? null;
      const fc = funcionario
        ? funcCompPorFuncionarioId.get(funcionario.id) ?? null
        : null;
      return { linha, funcComp: fc, funcionario };
    });
  }, [linhasArquivo, funcionariosPorCodigo, funcCompPorFuncionarioId]);

  const naObraSelecionada = (c: LinhaConciliada) =>
    (c.funcComp?.obra_snapshot ?? "").trim() === obraSelecionada;

  const matched = conciliadas.filter((c) => c.funcComp && naObraSelecionada(c));
  const foraDaObra = conciliadas.filter((c) => c.funcComp && !naObraSelecionada(c));
  const semFuncionario = conciliadas.filter((c) => !c.funcionario);
  const semNaCompetencia = conciliadas.filter((c) => c.funcionario && !c.funcComp);

  async function aplicarImportacao() {
    if (matched.length === 0) return;
    setApplying(true);

    // Valor diário: só atualiza quando a planilha de ponto traz um valor
    // diferente do que já está salvo (evita sobrescrever com branco/igual).
    // VR: sempre sobrescreve quando a coluna existe no arquivo, inclusive
    // apagando um VR já cadastrado se a célula vier em branco — confirmado
    // com o Alan que essa é a regra certa (VR é sempre reflexo fiel do que
    // está na planilha de ponto daquele mês).
    let atualizacoesFuncComp = 0;

    for (const c of matched) {
      const updates: Record<string, number | null> = {};
      const novoValorDiario =
        colunasEncontradas.valorDiario &&
        c.linha.valorDiario != null &&
        c.linha.valorDiario !== c.funcComp!.valor_diario
          ? c.linha.valorDiario
          : null;

      if (novoValorDiario != null) updates.valor_diario = novoValorDiario;
      // Dias úteis de VT: a planilha de ponto é a fonte da verdade (inclui 0 pra
      // quem não recebe VT). O banco recalcula valor_total a partir de dias_uteis.
      if (colunasEncontradas.dias) updates.dias_uteis = c.linha.dias;
      if (colunasEncontradas.vrValor) updates.vr_valor = c.linha.vrValor;

      if (Object.keys(updates).length > 0) {
        const { error: errUpdate } = await supabase
          .from("vt_funcionario_competencia")
          .update(updates)
          .eq("id", c.funcComp!.id);
        if (!errUpdate) atualizacoesFuncComp++;
      }
    }

    const rows = matched.map((c) => ({
      func_comp_id: c.funcComp!.id,
      h50: c.linha.h50,
      h70: c.linha.h70,
      h100: c.linha.h100,
      faltas: c.linha.faltas,
      dsr: c.linha.dsr,
      ad_not: c.linha.adNot,
      premio: c.linha.premio,
      dias_reembolso: c.linha.diasReembolso,
      dias_desconto: c.linha.diasDesconto,
      // valores já vêm prontos da planilha (Total M.A / Valor Desc VT) — sem cálculo
      valor_reembolso: c.linha.valorReembolso,
      valor_desconto: c.linha.valorDesconto,
      cesta_basica: c.linha.cestaBasica,
      reembolso_vr: c.linha.reembolsoVr,
      arquivo_origem: fileName,
    }));

    const { error } = await supabase
      .from("vt_apontamento")
      .upsert(rows, { onConflict: "func_comp_id" });

    setApplying(false);
    if (error) {
      setResultado(`Erro ao aplicar: ${error.message}`);
      return;
    }

    setResultado(
      `${rows.length} apontamento(s) importado(s) para ${obraSelecionada}` +
        (atualizacoesFuncComp > 0
          ? ` (${atualizacoesFuncComp} com valor diário/VR atualizado).`
          : ".")
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-500 dark:text-slate-400">
        {nomeCompetencia(competenciaAtual.ano, competenciaAtual.mes)} — planilha de
        ponto (50%, 70%, 100%, Faltas, DSR, Ad.Not, Prêmio). O arquivo pode trazer
        outras obras junto (ex.: segmentação de dados do Excel) — só o que for da
        obra selecionada abaixo é aplicado.
      </p>

      <div className="flex flex-col gap-1 max-w-xs">
        <label className="text-[11.5px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Obra deste apontamento
        </label>
        <select
          value={obraSelecionada}
          onChange={(e) => setObraSelecionada(e.target.value)}
          className="input w-full"
        >
          <option value="">Selecione a obra...</option>
          {obras.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      </div>

      <div
        onClick={() => obraSelecionada && inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          if (!obraSelecionada) return;
          const file = e.dataTransfer.files?.[0];
          if (file) handleFile(file);
        }}
        className={`border-2 border-dashed rounded-xl p-10 text-center transition bg-white dark:bg-slate-900 ${
          obraSelecionada
            ? "border-slate-300 dark:border-slate-700 cursor-pointer hover:border-agos-green"
            : "border-slate-200 dark:border-slate-800 opacity-50 cursor-not-allowed"
        }`}
      >
        <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
          {obraSelecionada
            ? "Arraste a planilha de ponto ou clique para selecionar"
            : "Selecione a obra acima antes de subir o arquivo"}
        </p>
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
          Cruza automaticamente por matrícula com o cadastro ativo da competência
        </p>
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls"
          className="hidden"
          disabled={!obraSelecionada}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
        />
      </div>

      {loading && (
        <p className="text-sm text-slate-500 dark:text-slate-400">Lendo arquivo...</p>
      )}

      {abaLida && (
        <p className="text-xs text-slate-400 dark:text-slate-500">
          Lendo a aba <span className="font-mono">&quot;{abaLida}&quot;</span> do arquivo.
        </p>
      )}

      {avisos.length > 0 && (
        <div className="rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950 p-3 text-xs text-amber-700 dark:text-amber-400">
          {avisos.map((a, i) => (
            <p key={i}>{a}</p>
          ))}
        </div>
      )}

      {conciliadas.length > 0 && (
        <>
          <div className="grid grid-cols-4 gap-3">
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4">
              <p className="text-[12px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Prontos para importar
              </p>
              <p className="text-[22px] font-bold mt-1 text-agos-green-dark dark:text-agos-green-light">
                {matched.length}
              </p>
            </div>
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4">
              <p className="text-[12px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
                De outra obra (ignorados)
              </p>
              <p className="text-[22px] font-bold mt-1 text-slate-400 dark:text-slate-500">
                {foraDaObra.length}
              </p>
            </div>
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4">
              <p className="text-[12px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Matrícula não encontrada
              </p>
              <p className="text-[22px] font-bold mt-1 text-red-600 dark:text-red-400">
                {semFuncionario.length}
              </p>
            </div>
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4">
              <p className="text-[12px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Fora da competência atual
              </p>
              <p className="text-[22px] font-bold mt-1 text-amber-600 dark:text-amber-400">
                {semNaCompetencia.length}
              </p>
            </div>
          </div>

          {(semFuncionario.length > 0 || semNaCompetencia.length > 0) && (
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
              <div className="px-4 py-2.5 text-xs font-semibold text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800">
                Divergências ({semFuncionario.length + semNaCompetencia.length})
              </div>
              <table className="w-full text-sm">
                <tbody>
                  {[...semFuncionario, ...semNaCompetencia].map((c, i) => (
                    <tr
                      key={i}
                      className="border-b border-slate-50 dark:border-slate-800/60 last:border-0"
                    >
                      <td className="py-2 px-3 font-mono text-xs text-slate-500">
                        {c.linha.matricula}
                      </td>
                      <td className="py-2 px-3 text-slate-700 dark:text-slate-300">
                        {c.funcionario?.nome ?? "—"}
                      </td>
                      <td className="py-2 px-3 text-xs text-slate-400">
                        {!c.funcionario
                          ? "Matrícula não existe no cadastro"
                          : "Não está na competência atual (funcionário dispensado ou não estava ATIVO na abertura)"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex items-center justify-between">
            {resultado && (
              <p className="text-sm text-agos-green-dark dark:text-agos-green-light">
                {resultado}
              </p>
            )}
            <button
              onClick={aplicarImportacao}
              disabled={applying || matched.length === 0 || !obraSelecionada}
              className="ml-auto bg-agos-green hover:bg-agos-green-dark text-white text-sm font-semibold rounded-lg px-4 py-2 disabled:opacity-60"
            >
              {applying
                ? "Importando..."
                : `Importar ${matched.length} apontamento(s) de ${obraSelecionada || "..."}`}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ------------------------------------------------------------------------
// Aba: Exportar Bitti — gera o CSV de fechamento de folha a partir do banco
// ------------------------------------------------------------------------

function ExportarBittiTab({
  competenciaAtual,
  funcComp,
  funcionarios,
}: {
  competenciaAtual: Competencia;
  funcComp: FuncCompLite[];
  funcionarios: FuncionarioLite[];
}) {
  const supabase = useMemo(() => createClient(), []);

  const [obraSelecionada, setObraSelecionada] = useState("");
  const [avisos, setAvisos] = useState<string[]>([]);
  const [gerando, setGerando] = useState(false);
  const [resumo, setResumo] = useState<ResumoEvento[] | null>(null);
  const [totalFuncionarios, setTotalFuncionarios] = useState<number | null>(null);

  const competenciaAAAAMM = `${competenciaAtual.ano}${String(competenciaAtual.mes).padStart(2, "0")}`;

  const obras = useMemo(
    () =>
      Array.from(
        new Set(funcComp.map((fc) => (fc.obra_snapshot ?? "").trim()).filter(Boolean))
      ).sort((a, b) => a.localeCompare(b, "pt-BR")),
    [funcComp]
  );

  const funcionariosPorId = useMemo(() => {
    const map = new Map<string, FuncionarioLite>();
    funcionarios.forEach((f) => map.set(f.id, f));
    return map;
  }, [funcionarios]);

  async function handleGerar() {
    if (!obraSelecionada) return;
    setGerando(true);
    setAvisos([]);
    setResumo(null);
    setTotalFuncionarios(null);

    // Só ATIVO na competência: dispensados no mês (mesmo com VR/valores
    // residuais no snapshot) não entram no fechamento de folha do Bitti.
    const funcCompDaObra = funcComp.filter(
      (fc) =>
        (fc.obra_snapshot ?? "").trim() === obraSelecionada &&
        fc.status_no_mes === "ATIVO"
    );

    if (funcCompDaObra.length === 0) {
      setAvisos([`Nenhum funcionário encontrado na obra "${obraSelecionada}" nesta competência.`]);
      setGerando(false);
      return;
    }

    const funcCompIds = funcCompDaObra.map((fc) => fc.id);

    const [{ data: apontamentos, error: errApt }, { data: lancamentos, error: errLanc }] =
      await Promise.all([
        supabase
          .from("vt_apontamento")
          .select(
            "func_comp_id, valor_reembolso, valor_desconto, cesta_basica, h50, h70, h100, faltas, dsr, ad_not, premio"
          )
          .in("func_comp_id", funcCompIds),
        supabase
          .from("vt_lancamentos")
          .select("func_comp_id, motivo, valor")
          .in("func_comp_id", funcCompIds),
      ]);

    if (errApt || errLanc) {
      setAvisos([
        `Erro ao buscar dados: ${errApt?.message ?? errLanc?.message}`,
      ]);
      setGerando(false);
      return;
    }

    const apontamentoPorFuncComp = new Map(
      (apontamentos ?? []).map((a) => [a.func_comp_id, a])
    );

    const reembolsoVtPorFuncComp = new Map<string, number>();
    const reembolsoVrPorFuncComp = new Map<string, number>();
    (lancamentos ?? []).forEach((l) => {
      if (l.motivo === "Reembolso VT") {
        reembolsoVtPorFuncComp.set(
          l.func_comp_id,
          (reembolsoVtPorFuncComp.get(l.func_comp_id) ?? 0) + l.valor
        );
      } else if (l.motivo === "Reembolso VR") {
        reembolsoVrPorFuncComp.set(
          l.func_comp_id,
          (reembolsoVrPorFuncComp.get(l.func_comp_id) ?? 0) + l.valor
        );
      }
    });

    const linhasEvento: LinhaEventoBitti[] = [];

    function add(evento: number, matricula: string | null, valor: number | null | undefined) {
      if (!matricula || !valor) return;
      linhasEvento.push({
        matricula,
        evento,
        tipo: tipoEvento(evento),
        valor,
      });
    }

    funcCompDaObra.forEach((fc) => {
      const f = funcionariosPorId.get(fc.funcionario_id);
      const matricula = f?.codigo ?? null;
      const apt = apontamentoPorFuncComp.get(fc.id);

      add(276, matricula, fc.valor_total);
      add(277, matricula, fc.vr_valor);
      add(271, matricula, apt?.valor_reembolso);
      add(903, matricula, apt?.valor_desconto);
      add(278, matricula, apt?.cesta_basica);
      add(150, matricula, apt?.h50);
      add(146, matricula, apt?.h70);
      add(153, matricula, apt?.h100);
      add(553, matricula, apt?.faltas);
      add(191, matricula, apt?.dsr);
      add(184, matricula, apt?.ad_not);
      add(909, matricula, apt?.premio);
      add(901, matricula, reembolsoVtPorFuncComp.get(fc.id));
      add(904, matricula, reembolsoVrPorFuncComp.get(fc.id));
    });

    const { linhas, resumo: resumoGerado } = gerarLinhasCsvBitti(
      linhasEvento,
      competenciaAAAAMM
    );

    if (linhas.length === 0) {
      setAvisos([
        "Nenhum valor encontrado para gerar linhas — confira se o apontamento e os lançamentos avulsos dessa obra já foram importados.",
      ]);
      setGerando(false);
      return;
    }

    baixarCsvBitti(
      linhas,
      `bitti_${obraSelecionada.replace(/\s+/g, "_")}_${competenciaAAAAMM}.csv`
    );

    setResumo(resumoGerado);
    setTotalFuncionarios(funcCompDaObra.length);
    setGerando(false);
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-500 dark:text-slate-400">
        {nomeCompetencia(competenciaAtual.ano, competenciaAtual.mes)} — gera o CSV de
        importação de eventos do Bitti (competência {competenciaAAAAMM}) a partir dos
        dados já lançados no sistema para a obra escolhida.
      </p>

      <div className="flex flex-col gap-1 max-w-xs">
        <label className="text-[11.5px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Obra
        </label>
        <select
          value={obraSelecionada}
          onChange={(e) => setObraSelecionada(e.target.value)}
          className="input w-full"
        >
          <option value="">Selecione a obra...</option>
          {obras.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      </div>

      {avisos.length > 0 && (
        <div className="rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950 p-3 text-xs text-amber-700 dark:text-amber-400">
          {avisos.map((a, i) => (
            <p key={i}>{a}</p>
          ))}
        </div>
      )}

      <button
        onClick={handleGerar}
        disabled={gerando || !obraSelecionada}
        className="bg-agos-green hover:bg-agos-green-dark text-white text-sm font-semibold rounded-lg px-4 py-2 disabled:opacity-60"
      >
        {gerando ? "Gerando..." : "Gerar e baixar CSV"}
      </button>

      {resumo && totalFuncionarios != null && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="px-4 py-2.5 text-xs font-semibold text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800">
            {totalFuncionarios} funcionário(s) na obra · CSV gerado com sucesso
          </div>
          <table className="w-full text-sm">
            <tbody>
              {resumo.map((r) => (
                <tr
                  key={r.evento}
                  className="border-b border-slate-50 dark:border-slate-800/60 last:border-0"
                >
                  <td className="py-2 px-3 font-mono text-xs text-slate-500 w-16">
                    {r.evento}
                  </td>
                  <td className="py-2 px-3 text-slate-700 dark:text-slate-300">
                    {r.descricao}
                  </td>
                  <td className="py-2 px-3 text-right text-xs text-slate-400">
                    {r.qtd} funcionário(s)
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
