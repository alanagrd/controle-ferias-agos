"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type {
  Competencia,
  Funcionario,
  FuncionarioCompetencia,
  LancamentoVt,
} from "@/lib/types";
import {
  COMPETENCIA_STATUS_BADGE_CLASS,
  COMPETENCIA_STATUS_LABEL,
  fmtMoeda,
  nomeCompetencia,
} from "@/lib/status-vt";
import { fmtDate } from "@/lib/status";
import { exportarPlanilhaVt } from "@/lib/export-vt";

type FuncionarioLite = Pick<
  Funcionario,
  "id" | "codigo" | "nome" | "obra" | "status" | "cliente_razao_social"
>;

type LancamentoLite = Pick<
  LancamentoVt,
  "id" | "func_comp_id" | "data" | "valor" | "motivo" | "cobrado_cliente"
>;

type Row = {
  fc: FuncionarioCompetencia;
  f: FuncionarioLite | undefined;
  vtAvulso: number;
  vrAvulso: number;
};

type SortKey = "nome" | "obra" | "cliente" | "total";

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const MOTIVO_OPCOES = [
  "Reembolso VT",
  "Desconto VT",
  "Reembolso VR",
  "Desconto VR",
] as const;

export default function VtFuncionariosClient({
  competenciaAtual,
  funcionarios,
  funcComp,
  lancamentos,
}: {
  competenciaAtual: Competencia | null;
  funcionarios: FuncionarioLite[];
  funcComp: FuncionarioCompetencia[];
  lancamentos: LancamentoLite[];
}) {
  const supabase = useMemo(() => createClient(), []);

  const [funcCompState, setFuncCompState] = useState(funcComp);
  const [lancamentosState, setLancamentosState] = useState(lancamentos);

  const [busca, setBusca] = useState("");
  const [obraFilter, setObraFilter] = useState("");
  const [clienteFilter, setClienteFilter] = useState("");
  const [mostrarDispensados, setMostrarDispensados] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("nome");
  const [sortDir, setSortDir] = useState<1 | -1>(1);

  const [showAbrirCompetencia, setShowAbrirCompetencia] = useState(false);
  const [showNovoFuncionario, setShowNovoFuncionario] = useState(false);
  const [editRow, setEditRow] = useState<Row | null>(null);
  const [lancamentosRow, setLancamentosRow] = useState<Row | null>(null);

  const funcionariosPorId = useMemo(() => {
    const map = new Map<string, FuncionarioLite>();
    funcionarios.forEach((f) => map.set(f.id, f));
    return map;
  }, [funcionarios]);

  const lancamentosPorFuncComp = useMemo(() => {
    const map = new Map<string, LancamentoLite[]>();
    lancamentosState.forEach((l) => {
      const arr = map.get(l.func_comp_id) ?? [];
      arr.push(l);
      map.set(l.func_comp_id, arr);
    });
    return map;
  }, [lancamentosState]);

  const rows = useMemo<Row[]>(
    () =>
      funcCompState.map((fc) => {
        const ls = lancamentosPorFuncComp.get(fc.id) ?? [];
        const vtAvulso = ls
          .filter((l) => l.motivo?.includes("VT"))
          .reduce((acc, l) => acc + l.valor, 0);
        const vrAvulso = ls
          .filter((l) => l.motivo?.includes("VR"))
          .reduce((acc, l) => acc + l.valor, 0);
        return {
          fc,
          f: funcionariosPorId.get(fc.funcionario_id),
          vtAvulso,
          vrAvulso,
        };
      }),
    [funcCompState, funcionariosPorId, lancamentosPorFuncComp]
  );

  const obras = useMemo(
    () =>
      Array.from(
        new Set(rows.map((r) => r.fc.obra_snapshot).filter((o): o is string => !!o))
      ).sort((a, b) => a.localeCompare(b, "pt-BR")),
    [rows]
  );

  const clientes = useMemo(
    () =>
      Array.from(
        new Set(
          rows.map((r) => r.f?.cliente_razao_social).filter((c): c is string => !!c)
        )
      ).sort((a, b) => a.localeCompare(b, "pt-BR")),
    [rows]
  );

  const filtered = useMemo(() => {
    const f = rows.filter((r) => {
      if (!mostrarDispensados && r.fc.status_no_mes === "DISPENSADO") return false;
      if (obraFilter && r.fc.obra_snapshot !== obraFilter) return false;
      if (clienteFilter && r.f?.cliente_razao_social !== clienteFilter) return false;
      if (busca.trim()) {
        const q = busca.trim().toUpperCase();
        const nome = r.f?.nome?.toUpperCase() ?? "";
        const codigo = r.f?.codigo ?? "";
        if (!nome.includes(q) && !codigo.includes(q)) return false;
      }
      return true;
    });

    const dir = sortDir;
    return f.sort((a, b) => {
      switch (sortKey) {
        case "obra":
          return dir * (a.fc.obra_snapshot ?? "").localeCompare(b.fc.obra_snapshot ?? "", "pt-BR");
        case "cliente":
          return (
            dir *
            (a.f?.cliente_razao_social ?? "").localeCompare(
              b.f?.cliente_razao_social ?? "",
              "pt-BR"
            )
          );
        case "total":
          return dir * ((a.fc.valor_total ?? 0) - (b.fc.valor_total ?? 0));
        case "nome":
        default:
          return dir * (a.f?.nome ?? "").localeCompare(b.f?.nome ?? "", "pt-BR");
      }
    });
  }, [rows, mostrarDispensados, obraFilter, clienteFilter, busca, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 1 ? -1 : 1));
    } else {
      setSortKey(key);
      setSortDir(1);
    }
  }

  const totalFiltrado = filtered.reduce((acc, r) => acc + (r.fc.valor_total ?? 0), 0);

  function handleExportar() {
    if (!competenciaAtual) return;
    exportarPlanilhaVt(
      filtered.map((r) => ({
        clienteCodigo: null,
        obra: r.fc.obra_snapshot,
        matricula: r.f?.codigo ?? null,
        nome: r.f?.nome ?? "",
        valorDiario: r.fc.valor_diario,
        dias: r.fc.dias_uteis,
        totalVt: r.fc.valor_total,
        vr: r.fc.vr_valor,
        reembolsoVt: Math.max(r.vtAvulso, 0),
        descontoVt: Math.max(-r.vtAvulso, 0),
        h50: 0,
        h70: 0,
        h100: 0,
        faltas: 0,
        dsr: 0,
        adNot: 0,
        premio: 0,
      })),
      `VT ${nomeCompetencia(competenciaAtual.ano, competenciaAtual.mes)}.xlsx`
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Funcionários & VT
          </h1>
          {competenciaAtual && (
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {nomeCompetencia(competenciaAtual.ano, competenciaAtual.mes)}
              </span>
              <span
                className={`text-[11px] font-semibold rounded-full px-2 py-0.5 ${
                  COMPETENCIA_STATUS_BADGE_CLASS[competenciaAtual.status]
                }`}
              >
                {COMPETENCIA_STATUS_LABEL[competenciaAtual.status]}
              </span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {competenciaAtual && (
            <>
              <button
                onClick={handleExportar}
                className="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-lg px-3.5 py-2 hover:bg-slate-200 dark:hover:bg-slate-700"
              >
                Exportar planilha
              </button>
              <button
                onClick={() => setShowNovoFuncionario(true)}
                className="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-lg px-3.5 py-2 hover:bg-slate-200 dark:hover:bg-slate-700"
              >
                + Novo funcionário
              </button>
            </>
          )}
          <button
            onClick={() => setShowAbrirCompetencia(true)}
            className="bg-agos-green hover:bg-agos-green-dark text-white text-xs font-semibold rounded-lg px-3.5 py-2"
          >
            + Abrir competência
          </button>
        </div>
      </div>

      {!competenciaAtual ? (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-8 text-center">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Nenhuma competência aberta ainda. Clique em &quot;Abrir competência&quot;
            para fazer o snapshot dos funcionários ativos.
          </p>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex flex-col gap-1">
              <label className="text-[11.5px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Buscar
              </label>
              <input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Nome ou matrícula..."
                className="input min-w-[220px]"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[11.5px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Cliente
              </label>
              <select
                value={clienteFilter}
                onChange={(e) => setClienteFilter(e.target.value)}
                className="input min-w-[200px]"
              >
                <option value="">Todos</option>
                {clientes.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[11.5px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Centro de custo (obra)
              </label>
              <select
                value={obraFilter}
                onChange={(e) => setObraFilter(e.target.value)}
                className="input min-w-[180px]"
              >
                <option value="">Todas</option>
                {obras.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </div>
            <label className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300 pb-2">
              <input
                type="checkbox"
                checked={mostrarDispensados}
                onChange={(e) => setMostrarDispensados(e.target.checked)}
              />
              Mostrar dispensados
            </label>
            <div className="ml-auto text-xs text-slate-500 dark:text-slate-400 pb-2">
              {filtered.length} de {rows.length} funcionário(s) · {fmtMoeda(totalFiltrado)}
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="overflow-x-auto max-h-[70vh]">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800 z-[1]">
                  <tr className="text-left text-xs text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                    <SortableTh label="Obra" active={sortKey === "obra"} dir={sortDir} onClick={() => toggleSort("obra")} />
                    <SortableTh label="Cliente" active={sortKey === "cliente"} dir={sortDir} onClick={() => toggleSort("cliente")} />
                    <SortableTh label="Funcionário" active={sortKey === "nome"} dir={sortDir} onClick={() => toggleSort("nome")} />
                    <th className="py-2.5 px-3 font-medium whitespace-nowrap">Matrícula</th>
                    <th className="py-2.5 px-3 font-medium whitespace-nowrap text-right">Valor/dia</th>
                    <th className="py-2.5 px-3 font-medium whitespace-nowrap text-right">Dias</th>
                    <SortableTh label="Total VT" align="right" active={sortKey === "total"} dir={sortDir} onClick={() => toggleSort("total")} />
                    <th className="py-2.5 px-3 font-medium whitespace-nowrap text-right">VR</th>
                    <th className="py-2.5 px-3 font-medium whitespace-nowrap text-right">Avulso VT</th>
                    <th className="py-2.5 px-3 font-medium whitespace-nowrap text-right">Avulso VR</th>
                    <th className="py-2.5 px-3 font-medium whitespace-nowrap">Status</th>
                    <th className="py-2.5 px-3 font-medium whitespace-nowrap"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => (
                    <tr
                      key={r.fc.id}
                      className="border-b border-slate-50 dark:border-slate-800/60 hover:bg-slate-50 dark:hover:bg-slate-800/60"
                    >
                      <td className="py-2 px-3 font-mono text-xs text-slate-500 dark:text-slate-400">
                        {r.fc.obra_snapshot ?? "—"}
                      </td>
                      <td className="py-2 px-3 text-xs text-slate-500 dark:text-slate-400 max-w-[160px] truncate">
                        {r.f?.cliente_razao_social ?? "—"}
                      </td>
                      <td className="py-2 px-3 font-medium text-slate-900 dark:text-slate-100">
                        {r.f?.nome ?? "(funcionário não encontrado)"}
                      </td>
                      <td className="py-2 px-3 font-mono text-xs text-slate-400">
                        {r.f?.codigo ?? "—"}
                      </td>
                      <td className="py-2 px-3 text-right text-slate-700 dark:text-slate-300">
                        {r.fc.valor_diario != null ? fmtMoeda(r.fc.valor_diario) : "—"}
                      </td>
                      <td className="py-2 px-3 text-right text-slate-700 dark:text-slate-300">
                        {r.fc.dias_uteis ?? "—"}
                      </td>
                      <td className="py-2 px-3 text-right font-semibold text-slate-900 dark:text-slate-100">
                        {fmtMoeda(r.fc.valor_total)}
                      </td>
                      <td className="py-2 px-3 text-right text-slate-700 dark:text-slate-300">
                        {r.fc.vr_valor != null ? fmtMoeda(r.fc.vr_valor) : "—"}
                      </td>
                      <td
                        className={`py-2 px-3 text-right ${
                          r.vtAvulso < 0
                            ? "text-red-600 dark:text-red-400"
                            : r.vtAvulso > 0
                            ? "text-agos-green-dark dark:text-agos-green-light"
                            : "text-slate-400"
                        }`}
                      >
                        {r.vtAvulso !== 0 ? fmtMoeda(r.vtAvulso) : "—"}
                      </td>
                      <td
                        className={`py-2 px-3 text-right ${
                          r.vrAvulso < 0
                            ? "text-red-600 dark:text-red-400"
                            : r.vrAvulso > 0
                            ? "text-agos-green-dark dark:text-agos-green-light"
                            : "text-slate-400"
                        }`}
                      >
                        {r.vrAvulso !== 0 ? fmtMoeda(r.vrAvulso) : "—"}
                      </td>
                      <td className="py-2 px-3">
                        <span
                          className={
                            r.fc.status_no_mes === "ATIVO"
                              ? "text-[11px] font-semibold rounded-full px-2 py-0.5 bg-agos-green/10 text-agos-green-dark"
                              : "text-[11px] font-semibold rounded-full px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-500"
                          }
                        >
                          {r.fc.status_no_mes === "ATIVO" ? "Ativo" : "Dispensado"}
                        </span>
                      </td>
                      <td className="py-2 px-3">
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => setEditRow(r)}
                            className="text-xs font-semibold text-agos-green-dark dark:text-agos-green-light hover:underline"
                          >
                            Editar
                          </button>
                          <button
                            onClick={() => setLancamentosRow(r)}
                            className="text-xs font-semibold text-slate-500 dark:text-slate-400 hover:underline"
                          >
                            Avulso{r.vtAvulso !== 0 || r.vrAvulso !== 0 ? "" : " +"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={12} className="py-4 px-3 text-slate-500 dark:text-slate-400">
                        Nenhum funcionário encontrado.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {showAbrirCompetencia && (
        <AbrirCompetenciaModal
          onClose={() => setShowAbrirCompetencia(false)}
          supabase={supabase}
        />
      )}

      {showNovoFuncionario && competenciaAtual && (
        <NovoFuncionarioModal
          competenciaId={competenciaAtual.id}
          funcionarios={funcionarios}
          jaNaCompetencia={new Set(funcCompState.map((fc) => fc.funcionario_id))}
          supabase={supabase}
          onClose={() => setShowNovoFuncionario(false)}
          onCreated={(novoFc, lancamento) => {
            setFuncCompState((prev) => [...prev, novoFc]);
            if (lancamento) setLancamentosState((prev) => [...prev, lancamento]);
            setShowNovoFuncionario(false);
          }}
        />
      )}

      {editRow && (
        <EditFuncCompModal
          row={editRow}
          supabase={supabase}
          onClose={() => setEditRow(null)}
          onSaved={(updated) => {
            setFuncCompState((prev) =>
              prev.map((fc) => (fc.id === updated.id ? updated : fc))
            );
            setEditRow(null);
          }}
        />
      )}

      {lancamentosRow && (
        <LancamentosFuncionarioModal
          row={lancamentosRow}
          lancamentos={lancamentosPorFuncComp.get(lancamentosRow.fc.id) ?? []}
          supabase={supabase}
          onClose={() => setLancamentosRow(null)}
          onCriado={(novo) => {
            setLancamentosState((prev) => [...prev, novo]);
          }}
          onAtualizado={(atualizado) => {
            setLancamentosState((prev) =>
              prev.map((l) => (l.id === atualizado.id ? atualizado : l))
            );
          }}
          onExcluido={(id) => {
            setLancamentosState((prev) => prev.filter((l) => l.id !== id));
          }}
        />
      )}
    </div>
  );
}

function SortableTh({
  label,
  active,
  dir,
  onClick,
  align = "left",
}: {
  label: string;
  active: boolean;
  dir: 1 | -1;
  onClick: () => void;
  align?: "left" | "right";
}) {
  return (
    <th
      onClick={onClick}
      className={`py-2.5 px-3 font-medium select-none cursor-pointer hover:text-slate-900 dark:hover:text-slate-100 whitespace-nowrap ${
        align === "right" ? "text-right" : ""
      }`}
    >
      {label}
      {active && <span className="ml-1">{dir === 1 ? "▲" : "▼"}</span>}
    </th>
  );
}

function AbrirCompetenciaModal({
  onClose,
  supabase,
}: {
  onClose: () => void;
  supabase: ReturnType<typeof createClient>;
}) {
  const hoje = new Date();
  const [ano, setAno] = useState(hoje.getFullYear());
  const [mes, setMes] = useState(hoje.getMonth() + 1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    setLoading(true);
    setError(null);

    const { data: competencia, error: errComp } = await supabase
      .from("vt_competencias")
      .upsert({ ano, mes }, { onConflict: "ano,mes", ignoreDuplicates: false })
      .select("id")
      .single();

    if (errComp || !competencia) {
      setError(errComp?.message ?? "Não foi possível criar a competência.");
      setLoading(false);
      return;
    }

    const { data: ativos, error: errAtivos } = await supabase
      .from("rh_funcionarios")
      .select("id, obra")
      .eq("status", "ATIVO");

    if (errAtivos) {
      setError(errAtivos.message);
      setLoading(false);
      return;
    }

    const rows = (ativos ?? []).map((f) => ({
      funcionario_id: f.id,
      competencia_id: competencia.id,
      obra_snapshot: f.obra,
      status_no_mes: "ATIVO" as const,
      tipo_vt: "DIARIO" as const,
    }));

    const { error: errSnapshot } = await supabase
      .from("vt_funcionario_competencia")
      .upsert(rows, {
        onConflict: "funcionario_id,competencia_id",
        ignoreDuplicates: true,
      });

    setLoading(false);
    if (errSnapshot) {
      setError(errSnapshot.message);
      return;
    }

    window.location.reload();
  }

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 w-full max-w-sm"
      >
        <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-1">
          Abrir competência
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
          Cria a competência (se ainda não existir) e faz o snapshot de todos os
          funcionários com status ATIVO no cadastro de RH.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="block text-[11.5px] uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1">
              Mês
            </span>
            <select
              value={mes}
              onChange={(e) => setMes(Number(e.target.value))}
              className="input w-full"
            >
              {MESES.map((m, i) => (
                <option key={m} value={i + 1}>
                  {m}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="block text-[11.5px] uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1">
              Ano
            </span>
            <input
              type="number"
              value={ano}
              onChange={(e) => setAno(Number(e.target.value))}
              className="input w-full"
            />
          </label>
        </div>
        {error && <p className="text-xs text-red-600 mt-3">{error}</p>}
        <div className="flex justify-end gap-2 mt-5">
          <button
            onClick={onClose}
            className="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-lg px-3.5 py-2 hover:bg-slate-200 dark:hover:bg-slate-700"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading}
            className="bg-agos-green hover:bg-agos-green-dark text-white text-xs font-semibold rounded-lg px-3.5 py-2 disabled:opacity-60"
          >
            {loading ? "Abrindo..." : "Abrir competência"}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Cadastro manual de um funcionário na competência aberta — para admissões
 * no meio do mês, que não entraram no snapshot inicial. Primeiro busca no
 * cadastro de RH (rh_funcionarios) já existente; se ninguém bater com a
 * busca, oferece cadastrar a pessoa na hora (grava em rh_funcionarios,
 * mesma tabela única usada por Férias/ASO — não duplica cadastro em lugar
 * nenhum, só evita ter que trocar de módulo pra registrar uma admissão).
 */
function NovoFuncionarioModal({
  competenciaId,
  funcionarios,
  jaNaCompetencia,
  supabase,
  onClose,
  onCreated,
}: {
  competenciaId: string;
  funcionarios: FuncionarioLite[];
  jaNaCompetencia: Set<string>;
  supabase: ReturnType<typeof createClient>;
  onClose: () => void;
  onCreated: (
    novoFc: FuncionarioCompetencia,
    lancamento: LancamentoLite | null
  ) => void;
}) {
  const [modo, setModo] = useState<"buscar" | "criar">("buscar");
  const [busca, setBusca] = useState("");
  const [selecionado, setSelecionado] = useState<FuncionarioLite | null>(null);

  // Campos do cadastro novo em rh_funcionarios (modo "criar")
  const [novoNome, setNovoNome] = useState("");
  const [novoCliente, setNovoCliente] = useState("");
  const [novoCargo, setNovoCargo] = useState("");
  const [novoSetor, setNovoSetor] = useState("");
  const [novaAdmissao, setNovaAdmissao] = useState("");

  const [obra, setObra] = useState("");
  const [valorDiario, setValorDiario] = useState("");
  const [diasUteis, setDiasUteis] = useState("");
  const [vrValor, setVrValor] = useState("");
  const [reembolsoInicial, setReembolsoInicial] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const candidatos = useMemo(() => {
    if (!busca.trim()) return [];
    const q = busca.trim().toUpperCase();
    return funcionarios
      .filter((f) => !jaNaCompetencia.has(f.id))
      .filter(
        (f) => f.nome.toUpperCase().includes(q) || (f.codigo ?? "").includes(q)
      )
      .slice(0, 8);
  }, [busca, funcionarios, jaNaCompetencia]);

  function selecionar(f: FuncionarioLite) {
    setSelecionado(f);
    setObra(f.obra ?? "");
    setBusca(f.nome);
  }

  function irParaCriar() {
    setNovoNome(busca);
    setModo("criar");
    setError(null);
  }

  async function adicionarNaCompetencia(funcionarioId: string) {
    const { data: fc, error: errFc } = await supabase
      .from("vt_funcionario_competencia")
      .insert({
        funcionario_id: funcionarioId,
        competencia_id: competenciaId,
        obra_snapshot: obra || null,
        status_no_mes: "ATIVO",
        tipo_vt: "DIARIO",
        valor_diario: valorDiario === "" ? null : Number(valorDiario),
        dias_uteis: diasUteis === "" ? null : Number(diasUteis),
        vr_valor: vrValor === "" ? null : Number(vrValor),
      })
      .select(
        "id, funcionario_id, competencia_id, obra_snapshot, status_no_mes, tipo_vt, valor_diario, dias_uteis, valor_total, vr_valor"
      )
      .single();

    if (errFc || !fc) {
      setError(errFc?.message ?? "Erro ao cadastrar na competência.");
      return null;
    }

    let lancamento: LancamentoLite | null = null;
    if (reembolsoInicial !== "") {
      const { data: l, error: errL } = await supabase
        .from("vt_lancamentos")
        .insert({
          func_comp_id: fc.id,
          data: new Date().toISOString().slice(0, 10),
          valor: Math.abs(Number(reembolsoInicial)),
          motivo: "Reembolso VT",
          cobrado_cliente: true,
        })
        .select("id, func_comp_id, data, valor, motivo, cobrado_cliente")
        .single();
      if (!errL) lancamento = l;
    }

    return { fc: fc as FuncionarioCompetencia, lancamento };
  }

  async function handleConfirmExistente() {
    if (!selecionado) {
      setError("Selecione um funcionário na busca.");
      return;
    }
    setLoading(true);
    setError(null);
    const result = await adicionarNaCompetencia(selecionado.id);
    setLoading(false);
    if (result) onCreated(result.fc, result.lancamento);
  }

  async function handleCriarECadastrar() {
    if (!novoNome.trim()) {
      setError("Informe o nome do funcionário.");
      return;
    }
    setLoading(true);
    setError(null);

    const { data: novoFuncionario, error: errNovo } = await supabase
      .from("rh_funcionarios")
      .insert({
        nome: novoNome.trim(),
        cliente_razao_social: novoCliente.trim() || null,
        obra: obra.trim() || null,
        cargo: novoCargo.trim() || null,
        setor: novoSetor.trim() || null,
        admissao: novaAdmissao || null,
        status: "ATIVO",
      })
      .select("id")
      .single();

    if (errNovo || !novoFuncionario) {
      setError(errNovo?.message ?? "Erro ao cadastrar funcionário.");
      setLoading(false);
      return;
    }

    const result = await adicionarNaCompetencia(novoFuncionario.id);
    setLoading(false);
    if (result) onCreated(result.fc, result.lancamento);
  }

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 w-full max-w-md"
      >
        <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-1">
          Novo funcionário na competência
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
          Para admissões no meio do mês.{" "}
          {modo === "buscar"
            ? "Busque primeiro — se a pessoa já tem cadastro de RH, é só selecionar."
            : "Cadastro novo no RH — vale pra todos os módulos (Férias, ASO, VT), não só o VT."}
        </p>

        {modo === "buscar" ? (
          <div className="space-y-3">
            <div className="relative">
              <label className="block text-[11.5px] uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1">
                Funcionário
              </label>
              <input
                value={busca}
                onChange={(e) => {
                  setBusca(e.target.value);
                  setSelecionado(null);
                }}
                placeholder="Buscar por nome ou matrícula..."
                className="input w-full"
              />
              {candidatos.length > 0 && !selecionado && (
                <div className="absolute z-10 mt-1 w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {candidatos.map((f) => (
                    <button
                      key={f.id}
                      onClick={() => selecionar(f)}
                      className="block w-full text-left px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-800"
                    >
                      <span className="font-medium text-slate-900 dark:text-slate-100">
                        {f.nome}
                      </span>
                      <span className="ml-2 text-xs text-slate-400">{f.codigo}</span>
                    </button>
                  ))}
                </div>
              )}
              {busca.trim().length > 1 && candidatos.length === 0 && !selecionado && (
                <div className="mt-2 flex items-center justify-between rounded-lg border border-dashed border-slate-300 dark:border-slate-700 px-3 py-2">
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    Ninguém encontrado com esse nome/matrícula.
                  </span>
                  <button
                    onClick={irParaCriar}
                    className="text-xs font-semibold text-agos-green-dark dark:text-agos-green-light hover:underline whitespace-nowrap ml-2"
                  >
                    + Cadastrar novo
                  </button>
                </div>
              )}
            </div>

            {selecionado && (
              <CamposCompetencia
                obra={obra}
                setObra={setObra}
                valorDiario={valorDiario}
                setValorDiario={setValorDiario}
                diasUteis={diasUteis}
                setDiasUteis={setDiasUteis}
                vrValor={vrValor}
                setVrValor={setVrValor}
                reembolsoInicial={reembolsoInicial}
                setReembolsoInicial={setReembolsoInicial}
              />
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <button
              onClick={() => {
                setModo("buscar");
                setError(null);
              }}
              className="text-xs font-semibold text-slate-500 dark:text-slate-400 hover:underline"
            >
              ← Voltar pra busca
            </button>
            <label className="block">
              <span className="block text-[11.5px] uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1">
                Nome
              </span>
              <input
                value={novoNome}
                onChange={(e) => setNovoNome(e.target.value)}
                className="input w-full"
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="block text-[11.5px] uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1">
                  Cliente
                </span>
                <input
                  value={novoCliente}
                  onChange={(e) => setNovoCliente(e.target.value)}
                  placeholder="Ex: GEOSONDA"
                  className="input w-full"
                />
              </label>
              <label className="block">
                <span className="block text-[11.5px] uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1">
                  Cargo
                </span>
                <input
                  value={novoCargo}
                  onChange={(e) => setNovoCargo(e.target.value)}
                  className="input w-full"
                />
              </label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="block text-[11.5px] uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1">
                  Setor
                </span>
                <input
                  value={novoSetor}
                  onChange={(e) => setNovoSetor(e.target.value)}
                  className="input w-full"
                />
              </label>
              <label className="block">
                <span className="block text-[11.5px] uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1">
                  Admissão
                </span>
                <input
                  type="date"
                  value={novaAdmissao}
                  onChange={(e) => setNovaAdmissao(e.target.value)}
                  className="input w-full"
                />
              </label>
            </div>

            <CamposCompetencia
              obra={obra}
              setObra={setObra}
              valorDiario={valorDiario}
              setValorDiario={setValorDiario}
              diasUteis={diasUteis}
              setDiasUteis={setDiasUteis}
              vrValor={vrValor}
              setVrValor={setVrValor}
              reembolsoInicial={reembolsoInicial}
              setReembolsoInicial={setReembolsoInicial}
            />
          </div>
        )}

        {error && <p className="text-xs text-red-600 mt-3">{error}</p>}
        <div className="flex justify-end gap-2 mt-5">
          <button
            onClick={onClose}
            className="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-lg px-3.5 py-2 hover:bg-slate-200 dark:hover:bg-slate-700"
          >
            Cancelar
          </button>
          {modo === "buscar" ? (
            <button
              onClick={handleConfirmExistente}
              disabled={loading || !selecionado}
              className="bg-agos-green hover:bg-agos-green-dark text-white text-xs font-semibold rounded-lg px-3.5 py-2 disabled:opacity-60"
            >
              {loading ? "Salvando..." : "Adicionar à competência"}
            </button>
          ) : (
            <button
              onClick={handleCriarECadastrar}
              disabled={loading}
              className="bg-agos-green hover:bg-agos-green-dark text-white text-xs font-semibold rounded-lg px-3.5 py-2 disabled:opacity-60"
            >
              {loading ? "Salvando..." : "Cadastrar e adicionar"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function CamposCompetencia({
  obra,
  setObra,
  valorDiario,
  setValorDiario,
  diasUteis,
  setDiasUteis,
  vrValor,
  setVrValor,
  reembolsoInicial,
  setReembolsoInicial,
}: {
  obra: string;
  setObra: (v: string) => void;
  valorDiario: string;
  setValorDiario: (v: string) => void;
  diasUteis: string;
  setDiasUteis: (v: string) => void;
  vrValor: string;
  setVrValor: (v: string) => void;
  reembolsoInicial: string;
  setReembolsoInicial: (v: string) => void;
}) {
  return (
    <>
      <label className="block">
        <span className="block text-[11.5px] uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1">
          Obra
        </span>
        <input
          value={obra}
          onChange={(e) => setObra(e.target.value)}
          className="input w-full"
        />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="block text-[11.5px] uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1">
            Valor diário VT (R$)
          </span>
          <input
            type="number"
            step="0.01"
            value={valorDiario}
            onChange={(e) => setValorDiario(e.target.value)}
            className="input w-full"
          />
        </label>
        <label className="block">
          <span className="block text-[11.5px] uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1">
            Dias
          </span>
          <input
            type="number"
            value={diasUteis}
            onChange={(e) => setDiasUteis(e.target.value)}
            className="input w-full"
          />
        </label>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="block text-[11.5px] uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1">
            VR do mês (R$)
          </span>
          <input
            type="number"
            step="0.01"
            value={vrValor}
            onChange={(e) => setVrValor(e.target.value)}
            className="input w-full"
          />
        </label>
        <label className="block">
          <span className="block text-[11.5px] uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1">
            Reembolso VT (opcional)
          </span>
          <input
            type="number"
            step="0.01"
            value={reembolsoInicial}
            onChange={(e) => setReembolsoInicial(e.target.value)}
            placeholder="0,00"
            className="input w-full"
          />
        </label>
      </div>
    </>
  );
}

function EditFuncCompModal({
  row,
  supabase,
  onClose,
  onSaved,
}: {
  row: Row;
  supabase: ReturnType<typeof createClient>;
  onClose: () => void;
  onSaved: (updated: FuncionarioCompetencia) => void;
}) {
  const [obra, setObra] = useState(row.fc.obra_snapshot ?? "");
  const [tipoVt, setTipoVt] = useState(row.fc.tipo_vt);
  const [valorDiario, setValorDiario] = useState(
    row.fc.valor_diario?.toString() ?? ""
  );
  const [diasUteis, setDiasUteis] = useState(row.fc.dias_uteis?.toString() ?? "");
  const [vrValor, setVrValor] = useState(row.fc.vr_valor?.toString() ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setLoading(true);
    setError(null);

    const { data, error: err } = await supabase
      .from("vt_funcionario_competencia")
      .update({
        obra_snapshot: obra || null,
        tipo_vt: tipoVt,
        valor_diario: valorDiario === "" ? null : Number(valorDiario),
        dias_uteis: diasUteis === "" ? null : Number(diasUteis),
        vr_valor: vrValor === "" ? null : Number(vrValor),
      })
      .eq("id", row.fc.id)
      .select(
        "id, funcionario_id, competencia_id, obra_snapshot, status_no_mes, tipo_vt, valor_diario, dias_uteis, valor_total, vr_valor"
      )
      .single();

    setLoading(false);
    if (err || !data) {
      setError(err?.message ?? "Erro ao salvar.");
      return;
    }
    onSaved(data as FuncionarioCompetencia);
  }

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 w-full max-w-sm"
      >
        <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-1">
          Editar VT
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
          {row.f?.nome}
        </p>
        <div className="space-y-3">
          <label className="block">
            <span className="block text-[11.5px] uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1">
              Obra
            </span>
            <input
              value={obra}
              onChange={(e) => setObra(e.target.value)}
              className="input w-full"
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="block text-[11.5px] uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1">
                Tipo
              </span>
              <select
                value={tipoVt}
                onChange={(e) =>
                  setTipoVt(e.target.value as "DIARIO" | "MENSAL")
                }
                className="input w-full"
              >
                <option value="DIARIO">Diário</option>
                <option value="MENSAL">Mensal</option>
              </select>
            </label>
            <label className="block">
              <span className="block text-[11.5px] uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1">
                Dias
              </span>
              <input
                type="number"
                value={diasUteis}
                onChange={(e) => setDiasUteis(e.target.value)}
                className="input w-full"
              />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="block text-[11.5px] uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1">
                Valor {tipoVt === "DIARIO" ? "diário" : "mensal"} (R$)
              </span>
              <input
                type="number"
                step="0.01"
                value={valorDiario}
                onChange={(e) => setValorDiario(e.target.value)}
                className="input w-full"
              />
            </label>
            <label className="block">
              <span className="block text-[11.5px] uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1">
                VR do mês (R$)
              </span>
              <input
                type="number"
                step="0.01"
                value={vrValor}
                onChange={(e) => setVrValor(e.target.value)}
                className="input w-full"
              />
            </label>
          </div>
        </div>
        {error && <p className="text-xs text-red-600 mt-3">{error}</p>}
        <div className="flex justify-end gap-2 mt-5">
          <button
            onClick={onClose}
            className="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-lg px-3.5 py-2 hover:bg-slate-200 dark:hover:bg-slate-700"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={loading}
            className="bg-agos-green hover:bg-agos-green-dark text-white text-xs font-semibold rounded-lg px-3.5 py-2 disabled:opacity-60"
          >
            {loading ? "Salvando..." : "Salvar alterações"}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Histórico de lançamentos avulsos (VT/VR) de um funcionário na competência
 * — lista, edita, exclui e permite adicionar novo, tudo num só lugar. Editar
 * é só pra corrigir erro de digitação; um novo pagamento avulso no mês deve
 * virar um lançamento novo (mantém o histórico de quando cada um foi pago,
 * útil pra conferir com a NF do cliente depois).
 */
function LancamentosFuncionarioModal({
  row,
  lancamentos,
  supabase,
  onClose,
  onCriado,
  onAtualizado,
  onExcluido,
}: {
  row: Row;
  lancamentos: LancamentoLite[];
  supabase: ReturnType<typeof createClient>;
  onClose: () => void;
  onCriado: (novo: LancamentoLite) => void;
  onAtualizado: (atualizado: LancamentoLite) => void;
  onExcluido: (id: string) => void;
}) {
  const [editando, setEditando] = useState<LancamentoLite | null>(null);
  const [criandoNovo, setCriandoNovo] = useState(false);

  async function handleDelete(id: string) {
    if (!confirm("Excluir este lançamento?")) return;
    const { error } = await supabase.from("vt_lancamentos").delete().eq("id", id);
    if (error) {
      alert(error.message);
      return;
    }
    onExcluido(id);
  }

  const ordenados = [...lancamentos].sort((a, b) => (a.data < b.data ? 1 : -1));

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 w-full max-w-lg"
      >
        <div className="flex items-start justify-between mb-1">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Lançamentos avulsos
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {row.f?.nome} — {row.fc.obra_snapshot}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 text-lg leading-none"
          >
            ×
          </button>
        </div>

        {ordenados.length === 0 ? (
          <p className="text-sm text-slate-400 dark:text-slate-500 py-4">
            Nenhum lançamento ainda.
          </p>
        ) : (
          <div className="mt-3 max-h-64 overflow-y-auto rounded-lg border border-slate-100 dark:border-slate-800">
            <table className="w-full text-sm">
              <tbody>
                {ordenados.map((l) => (
                  <tr
                    key={l.id}
                    className="border-b border-slate-50 dark:border-slate-800/60 last:border-0"
                  >
                    <td className="py-2 px-3 text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                      {fmtDate(l.data)}
                    </td>
                    <td className="py-2 px-3 text-slate-700 dark:text-slate-300 whitespace-nowrap">
                      {l.motivo}
                    </td>
                    <td
                      className={`py-2 px-3 text-right font-semibold whitespace-nowrap ${
                        l.valor < 0
                          ? "text-red-600 dark:text-red-400"
                          : "text-slate-900 dark:text-slate-100"
                      }`}
                    >
                      {fmtMoeda(l.valor)}
                    </td>
                    <td className="py-2 px-3 text-right whitespace-nowrap">
                      <button
                        onClick={() => setEditando(l)}
                        className="text-xs font-semibold text-agos-green-dark dark:text-agos-green-light hover:underline mr-2.5"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => handleDelete(l.id)}
                        className="text-slate-400 hover:text-red-500 text-sm px-1"
                        title="Excluir"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {criandoNovo ? (
          <NovoLancamentoForm
            funcCompId={row.fc.id}
            supabase={supabase}
            onCancel={() => setCriandoNovo(false)}
            onSaved={(novo) => {
              onCriado(novo);
              setCriandoNovo(false);
            }}
          />
        ) : (
          <button
            onClick={() => setCriandoNovo(true)}
            className="mt-4 text-xs font-semibold text-agos-green-dark dark:text-agos-green-light hover:underline"
          >
            + Novo lançamento
          </button>
        )}

        {editando && (
          <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
            <EditLancamentoForm
              lancamento={editando}
              supabase={supabase}
              onCancel={() => setEditando(null)}
              onSaved={(atualizado) => {
                onAtualizado(atualizado);
                setEditando(null);
              }}
            />
          </div>
        )}

        <div className="flex justify-end mt-5">
          <button
            onClick={onClose}
            className="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-lg px-3.5 py-2 hover:bg-slate-200 dark:hover:bg-slate-700"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}

function NovoLancamentoForm({
  funcCompId,
  supabase,
  onCancel,
  onSaved,
}: {
  funcCompId: string;
  supabase: ReturnType<typeof createClient>;
  onCancel: () => void;
  onSaved: (lancamento: LancamentoLite) => void;
}) {
  const [motivo, setMotivo] = useState<(typeof MOTIVO_OPCOES)[number]>(
    "Reembolso VT"
  );
  const [valor, setValor] = useState("");
  const [cobradoCliente, setCobradoCliente] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    if (!valor) {
      setError("Informe o valor.");
      return;
    }
    setLoading(true);
    setError(null);

    const valorNum = Number(valor);
    const isDesconto = motivo.startsWith("Desconto");
    const { data, error: err } = await supabase
      .from("vt_lancamentos")
      .insert({
        func_comp_id: funcCompId,
        data: new Date().toISOString().slice(0, 10),
        valor: isDesconto ? -Math.abs(valorNum) : Math.abs(valorNum),
        motivo,
        cobrado_cliente: cobradoCliente,
      })
      .select("id, func_comp_id, data, valor, motivo, cobrado_cliente")
      .single();

    setLoading(false);
    if (err || !data) {
      setError(err?.message ?? "Erro ao salvar.");
      return;
    }
    onSaved(data);
  }

  return (
    <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="block text-[11.5px] uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1">
            Motivo
          </span>
          <select
            value={motivo}
            onChange={(e) =>
              setMotivo(e.target.value as (typeof MOTIVO_OPCOES)[number])
            }
            className="input w-full"
          >
            {MOTIVO_OPCOES.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="block text-[11.5px] uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1">
            Valor (R$)
          </span>
          <input
            type="number"
            step="0.01"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            placeholder="0,00"
            className="input w-full"
          />
        </label>
      </div>
      <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
        <input
          type="checkbox"
          checked={cobradoCliente}
          onChange={(e) => setCobradoCliente(e.target.checked)}
        />
        Cobrar do cliente na próxima NF
      </label>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex justify-end gap-2">
        <button
          onClick={onCancel}
          className="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-lg px-3.5 py-2 hover:bg-slate-200 dark:hover:bg-slate-700"
        >
          Cancelar
        </button>
        <button
          onClick={handleSave}
          disabled={loading}
          className="bg-agos-green hover:bg-agos-green-dark text-white text-xs font-semibold rounded-lg px-3.5 py-2 disabled:opacity-60"
        >
          {loading ? "Salvando..." : "Salvar lançamento"}
        </button>
      </div>
    </div>
  );
}

function EditLancamentoForm({
  lancamento,
  supabase,
  onCancel,
  onSaved,
}: {
  lancamento: LancamentoLite;
  supabase: ReturnType<typeof createClient>;
  onCancel: () => void;
  onSaved: (atualizado: LancamentoLite) => void;
}) {
  const motivoInicial = (MOTIVO_OPCOES as readonly string[]).includes(
    lancamento.motivo ?? ""
  )
    ? (lancamento.motivo as (typeof MOTIVO_OPCOES)[number])
    : "Reembolso VT";

  const [motivo, setMotivo] = useState<(typeof MOTIVO_OPCOES)[number]>(motivoInicial);
  const [valor, setValor] = useState(Math.abs(lancamento.valor).toString());
  const [data, setData] = useState(lancamento.data);
  const [cobradoCliente, setCobradoCliente] = useState(lancamento.cobrado_cliente);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    if (!valor) {
      setError("Informe o valor.");
      return;
    }
    setLoading(true);
    setError(null);

    const valorNum = Number(valor);
    const isDesconto = motivo.startsWith("Desconto");
    const { data: updated, error: err } = await supabase
      .from("vt_lancamentos")
      .update({
        data,
        valor: isDesconto ? -Math.abs(valorNum) : Math.abs(valorNum),
        motivo,
        cobrado_cliente: cobradoCliente,
      })
      .eq("id", lancamento.id)
      .select("id, func_comp_id, data, valor, motivo, cobrado_cliente")
      .single();

    setLoading(false);
    if (err || !updated) {
      setError(err?.message ?? "Erro ao salvar.");
      return;
    }
    onSaved(updated);
  }

  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
        Editando lançamento
      </p>
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="block text-[11.5px] uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1">
            Data
          </span>
          <input
            type="date"
            value={data}
            onChange={(e) => setData(e.target.value)}
            className="input w-full"
          />
        </label>
        <label className="block">
          <span className="block text-[11.5px] uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1">
            Motivo
          </span>
          <select
            value={motivo}
            onChange={(e) =>
              setMotivo(e.target.value as (typeof MOTIVO_OPCOES)[number])
            }
            className="input w-full"
          >
            {MOTIVO_OPCOES.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="block">
        <span className="block text-[11.5px] uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1">
          Valor (R$)
        </span>
        <input
          type="number"
          step="0.01"
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          className="input w-full"
        />
      </label>
      <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
        <input
          type="checkbox"
          checked={cobradoCliente}
          onChange={(e) => setCobradoCliente(e.target.checked)}
        />
        Cobrar do cliente na próxima NF
      </label>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex justify-end gap-2">
        <button
          onClick={onCancel}
          className="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-lg px-3.5 py-2 hover:bg-slate-200 dark:hover:bg-slate-700"
        >
          Cancelar
        </button>
        <button
          onClick={handleSave}
          disabled={loading}
          className="bg-agos-green hover:bg-agos-green-dark text-white text-xs font-semibold rounded-lg px-3.5 py-2 disabled:opacity-60"
        >
          {loading ? "Salvando..." : "Salvar alterações"}
        </button>
      </div>
    </div>
  );
}
