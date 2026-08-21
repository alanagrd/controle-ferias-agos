"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type {
  Competencia,
  Funcionario,
  FuncionarioCompetencia,
  LancamentoVt,
} from "@/lib/types";
import { fmtMoeda, nomeCompetencia } from "@/lib/status-vt";
import { fmtDate } from "@/lib/status";

type FuncionarioLite = Pick<
  Funcionario,
  "id" | "codigo" | "nome" | "obra" | "status" | "cliente_razao_social"
>;

type FuncCompLite = Pick<
  FuncionarioCompetencia,
  "id" | "funcionario_id" | "competencia_id" | "obra_snapshot"
>;

type LancamentoLite = Pick<
  LancamentoVt,
  "id" | "func_comp_id" | "data" | "valor" | "motivo" | "cobrado_cliente"
>;

type Row = {
  l: LancamentoLite;
  fc: FuncCompLite | undefined;
  f: FuncionarioLite | undefined;
};

const MOTIVO_OPCOES = [
  "Reembolso VT",
  "Desconto VT",
  "Reembolso VR",
  "Desconto VR",
] as const;

export default function VtLancamentosClient({
  competenciaAtual,
  lancamentos,
  funcComp,
  funcionarios,
}: {
  competenciaAtual: Competencia | null;
  lancamentos: LancamentoLite[];
  funcComp: FuncCompLite[];
  funcionarios: FuncionarioLite[];
}) {
  const supabase = useMemo(() => createClient(), []);
  const [lancamentosState, setLancamentosState] = useState(lancamentos);
  const [filtroCobranca, setFiltroCobranca] = useState<"" | "sim" | "nao">("");
  const [editRow, setEditRow] = useState<Row | null>(null);

  const funcCompPorId = useMemo(() => {
    const map = new Map<string, FuncCompLite>();
    funcComp.forEach((fc) => map.set(fc.id, fc));
    return map;
  }, [funcComp]);

  const funcionariosPorId = useMemo(() => {
    const map = new Map<string, FuncionarioLite>();
    funcionarios.forEach((f) => map.set(f.id, f));
    return map;
  }, [funcionarios]);

  const rows = useMemo<Row[]>(
    () =>
      lancamentosState.map((l) => {
        const fc = funcCompPorId.get(l.func_comp_id);
        const f = fc ? funcionariosPorId.get(fc.funcionario_id) : undefined;
        return { l, fc, f };
      }),
    [lancamentosState, funcCompPorId, funcionariosPorId]
  );

  const filtered = rows.filter((r) => {
    if (filtroCobranca === "sim" && !r.l.cobrado_cliente) return false;
    if (filtroCobranca === "nao" && r.l.cobrado_cliente) return false;
    return true;
  });

  const totalCobrar = filtered
    .filter((r) => r.l.cobrado_cliente)
    .reduce((acc, r) => acc + r.l.valor, 0);

  async function handleDelete(id: string) {
    if (!confirm("Excluir este lançamento?")) return;
    const { error } = await supabase.from("vt_lancamentos").delete().eq("id", id);
    if (error) {
      alert(error.message);
      return;
    }
    setLancamentosState((prev) => prev.filter((l) => l.id !== id));
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
          Lançamentos avulsos
        </h1>
        {competenciaAtual && (
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {nomeCompetencia(competenciaAtual.ano, competenciaAtual.mes)} — reembolsos e
            descontos de VT solicitados durante o mês
          </p>
        )}
      </div>

      {!competenciaAtual ? (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-8 text-center">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Nenhuma competência aberta ainda.
          </p>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex flex-col gap-1">
              <label className="text-[11.5px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Cobrança do cliente
              </label>
              <select
                value={filtroCobranca}
                onChange={(e) =>
                  setFiltroCobranca(e.target.value as "" | "sim" | "nao")
                }
                className="input min-w-[180px]"
              >
                <option value="">Todos</option>
                <option value="sim">A cobrar</option>
                <option value="nao">Interno</option>
              </select>
            </div>
            <div className="ml-auto text-xs text-slate-500 dark:text-slate-400 pb-2">
              {filtered.length} lançamento(s) · {fmtMoeda(totalCobrar)} a cobrar do cliente
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800">
                <tr className="text-left text-xs text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                  <th className="py-2.5 px-3 font-medium whitespace-nowrap">Data</th>
                  <th className="py-2.5 px-3 font-medium whitespace-nowrap">Funcionário</th>
                  <th className="py-2.5 px-3 font-medium whitespace-nowrap">Obra</th>
                  <th className="py-2.5 px-3 font-medium whitespace-nowrap">Motivo</th>
                  <th className="py-2.5 px-3 font-medium whitespace-nowrap text-right">Valor</th>
                  <th className="py-2.5 px-3 font-medium whitespace-nowrap">Cobrança</th>
                  <th className="py-2.5 px-3 font-medium whitespace-nowrap"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr
                    key={r.l.id}
                    className="border-b border-slate-50 dark:border-slate-800/60 hover:bg-slate-50 dark:hover:bg-slate-800/60"
                  >
                    <td className="py-2 px-3 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                      {fmtDate(r.l.data)}
                    </td>
                    <td className="py-2 px-3 font-medium text-slate-900 dark:text-slate-100">
                      {r.f?.nome ?? "—"}
                    </td>
                    <td className="py-2 px-3 font-mono text-xs text-slate-500 dark:text-slate-400">
                      {r.fc?.obra_snapshot ?? "—"}
                    </td>
                    <td className="py-2 px-3 text-slate-700 dark:text-slate-300">
                      {r.l.motivo}
                    </td>
                    <td
                      className={`py-2 px-3 text-right font-semibold ${
                        r.l.valor < 0
                          ? "text-red-600 dark:text-red-400"
                          : "text-slate-900 dark:text-slate-100"
                      }`}
                    >
                      {fmtMoeda(r.l.valor)}
                    </td>
                    <td className="py-2 px-3">
                      {r.l.cobrado_cliente ? (
                        <span className="text-[11px] font-semibold rounded-full px-2 py-0.5 bg-agos-orange/10 text-agos-orange-dark">
                          Cobrar do cliente
                        </span>
                      ) : (
                        <span className="text-[11px] font-semibold rounded-full px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-500">
                          Interno
                        </span>
                      )}
                    </td>
                    <td className="py-2 px-3">
                      <div className="flex items-center gap-2.5">
                        <button
                          onClick={() => setEditRow(r)}
                          className="text-xs font-semibold text-agos-green-dark dark:text-agos-green-light hover:underline"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => handleDelete(r.l.id)}
                          className="text-slate-400 hover:text-red-500 text-sm px-1"
                          title="Excluir"
                        >
                          ✕
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-4 px-3 text-slate-500 dark:text-slate-400">
                      Nenhum lançamento avulso nesta competência.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {editRow && (
        <EditLancamentoModal
          row={editRow}
          supabase={supabase}
          onClose={() => setEditRow(null)}
          onSaved={(updated) => {
            setLancamentosState((prev) =>
              prev.map((l) => (l.id === updated.id ? updated : l))
            );
            setEditRow(null);
          }}
        />
      )}
    </div>
  );
}

function EditLancamentoModal({
  row,
  supabase,
  onClose,
  onSaved,
}: {
  row: Row;
  supabase: ReturnType<typeof createClient>;
  onClose: () => void;
  onSaved: (updated: LancamentoLite) => void;
}) {
  const motivoInicial = (MOTIVO_OPCOES as readonly string[]).includes(row.l.motivo ?? "")
    ? (row.l.motivo as (typeof MOTIVO_OPCOES)[number])
    : "Reembolso VT";

  const [motivo, setMotivo] = useState<(typeof MOTIVO_OPCOES)[number]>(motivoInicial);
  const [valor, setValor] = useState(Math.abs(row.l.valor).toString());
  const [data, setData] = useState(row.l.data);
  const [cobradoCliente, setCobradoCliente] = useState(row.l.cobrado_cliente);
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
      .eq("id", row.l.id)
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
    <div
      onClick={onClose}
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 w-full max-w-sm"
      >
        <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-1">
          Editar lançamento
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
          {row.f?.nome} — {row.fc?.obra_snapshot}
        </p>
        <div className="space-y-3">
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
