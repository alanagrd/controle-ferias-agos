"use client";

import { useMemo, useState } from "react";
import type { ApontamentoVt, Competencia, Funcionario, FuncionarioCompetencia } from "@/lib/types";
import { nomeCompetencia } from "@/lib/status-vt";

type FuncionarioLite = Pick<
  Funcionario,
  "id" | "codigo" | "nome" | "obra" | "status" | "cliente_razao_social"
>;

type FuncCompLite = Pick<
  FuncionarioCompetencia,
  "id" | "funcionario_id" | "competencia_id" | "obra_snapshot"
>;

type ApontamentoLite = Pick<
  ApontamentoVt,
  | "id"
  | "func_comp_id"
  | "h50"
  | "h70"
  | "h100"
  | "faltas"
  | "dsr"
  | "ad_not"
  | "premio"
  | "dias_reembolso"
  | "dias_desconto"
  | "arquivo_origem"
>;

type Row = {
  fc: FuncCompLite;
  f: FuncionarioLite | undefined;
  a: ApontamentoLite | undefined;
};

type SortKey = "nome" | "obra";

function fmtNum(v: number | undefined): string {
  if (!v) return "—";
  return v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function VtApontamentoClient({
  competenciaAtual,
  funcComp,
  funcionarios,
  apontamentos,
}: {
  competenciaAtual: Competencia | null;
  funcComp: FuncCompLite[];
  funcionarios: FuncionarioLite[];
  apontamentos: ApontamentoLite[];
}) {
  const [busca, setBusca] = useState("");
  const [obraFilter, setObraFilter] = useState("");
  const [somenteComApontamento, setSomenteComApontamento] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>("nome");
  const [sortDir, setSortDir] = useState<1 | -1>(1);

  const funcionariosPorId = useMemo(() => {
    const map = new Map<string, FuncionarioLite>();
    funcionarios.forEach((f) => map.set(f.id, f));
    return map;
  }, [funcionarios]);

  const apontamentosPorFuncComp = useMemo(() => {
    const map = new Map<string, ApontamentoLite>();
    apontamentos.forEach((a) => map.set(a.func_comp_id, a));
    return map;
  }, [apontamentos]);

  const rows = useMemo<Row[]>(
    () =>
      funcComp.map((fc) => ({
        fc,
        f: funcionariosPorId.get(fc.funcionario_id),
        a: apontamentosPorFuncComp.get(fc.id),
      })),
    [funcComp, funcionariosPorId, apontamentosPorFuncComp]
  );

  const obras = useMemo(
    () =>
      Array.from(
        new Set(rows.map((r) => r.fc.obra_snapshot).filter((o): o is string => !!o))
      ).sort((a, b) => a.localeCompare(b, "pt-BR")),
    [rows]
  );

  const temApontamento = (a: ApontamentoLite | undefined) =>
    !!a &&
    !!(
      a.h50 ||
      a.h70 ||
      a.h100 ||
      a.faltas ||
      a.dsr ||
      a.ad_not ||
      a.premio ||
      a.dias_reembolso ||
      a.dias_desconto
    );

  const filtered = useMemo(() => {
    const f = rows.filter((r) => {
      if (somenteComApontamento && !temApontamento(r.a)) return false;
      if (obraFilter && r.fc.obra_snapshot !== obraFilter) return false;
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
      if (sortKey === "obra") {
        return dir * (a.fc.obra_snapshot ?? "").localeCompare(b.fc.obra_snapshot ?? "", "pt-BR");
      }
      return dir * (a.f?.nome ?? "").localeCompare(b.f?.nome ?? "", "pt-BR");
    });
  }, [rows, somenteComApontamento, obraFilter, busca, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 1 ? -1 : 1));
    } else {
      setSortKey(key);
      setSortDir(1);
    }
  }

  const comApontamento = rows.filter((r) => temApontamento(r.a)).length;

  if (!competenciaAtual) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-8 text-center">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Nenhuma competência aberta ainda.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
          Apontamento
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          {nomeCompetencia(competenciaAtual.ano, competenciaAtual.mes)} — horas extras,
          faltas e ocorrências importadas da planilha de ponto de cada obra
        </p>
      </div>

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
            Obra
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
            checked={somenteComApontamento}
            onChange={(e) => setSomenteComApontamento(e.target.checked)}
          />
          Só quem tem apontamento lançado
        </label>
        <div className="ml-auto text-xs text-slate-500 dark:text-slate-400 pb-2">
          {comApontamento} de {rows.length} funcionário(s) com apontamento importado
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="overflow-x-auto max-h-[70vh]">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800 z-[1]">
              <tr className="text-left text-xs text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                <th
                  onClick={() => toggleSort("obra")}
                  className="py-2.5 px-3 font-medium cursor-pointer select-none hover:text-slate-900 dark:hover:text-slate-100 whitespace-nowrap"
                >
                  Obra {sortKey === "obra" && (sortDir === 1 ? "▲" : "▼")}
                </th>
                <th
                  onClick={() => toggleSort("nome")}
                  className="py-2.5 px-3 font-medium cursor-pointer select-none hover:text-slate-900 dark:hover:text-slate-100 whitespace-nowrap"
                >
                  Funcionário {sortKey === "nome" && (sortDir === 1 ? "▲" : "▼")}
                </th>
                <th className="py-2.5 px-3 font-medium whitespace-nowrap">Matrícula</th>
                <th className="py-2.5 px-3 font-medium whitespace-nowrap text-right">50%</th>
                <th className="py-2.5 px-3 font-medium whitespace-nowrap text-right">70%</th>
                <th className="py-2.5 px-3 font-medium whitespace-nowrap text-right">100%</th>
                <th className="py-2.5 px-3 font-medium whitespace-nowrap text-right">Faltas</th>
                <th className="py-2.5 px-3 font-medium whitespace-nowrap text-right">DSR</th>
                <th className="py-2.5 px-3 font-medium whitespace-nowrap text-right">Ad.Not</th>
                <th className="py-2.5 px-3 font-medium whitespace-nowrap text-right">Prêmio</th>
                <th className="py-2.5 px-3 font-medium whitespace-nowrap text-right">Dias reembolso</th>
                <th className="py-2.5 px-3 font-medium whitespace-nowrap text-right">Dias desconto</th>
                <th className="py-2.5 px-3 font-medium whitespace-nowrap">Arquivo</th>
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
                  <td className="py-2 px-3 font-medium text-slate-900 dark:text-slate-100">
                    {r.f?.nome ?? "(funcionário não encontrado)"}
                  </td>
                  <td className="py-2 px-3 font-mono text-xs text-slate-400">
                    {r.f?.codigo ?? "—"}
                  </td>
                  <td className="py-2 px-3 text-right text-slate-700 dark:text-slate-300">
                    {fmtNum(r.a?.h50)}
                  </td>
                  <td className="py-2 px-3 text-right text-slate-700 dark:text-slate-300">
                    {fmtNum(r.a?.h70)}
                  </td>
                  <td className="py-2 px-3 text-right text-slate-700 dark:text-slate-300">
                    {fmtNum(r.a?.h100)}
                  </td>
                  <td className="py-2 px-3 text-right text-red-600 dark:text-red-400">
                    {fmtNum(r.a?.faltas)}
                  </td>
                  <td className="py-2 px-3 text-right text-slate-700 dark:text-slate-300">
                    {fmtNum(r.a?.dsr)}
                  </td>
                  <td className="py-2 px-3 text-right text-slate-700 dark:text-slate-300">
                    {fmtNum(r.a?.ad_not)}
                  </td>
                  <td className="py-2 px-3 text-right text-agos-green-dark dark:text-agos-green-light">
                    {fmtNum(r.a?.premio)}
                  </td>
                  <td className="py-2 px-3 text-right text-slate-700 dark:text-slate-300">
                    {fmtNum(r.a?.dias_reembolso)}
                  </td>
                  <td className="py-2 px-3 text-right text-red-600 dark:text-red-400">
                    {fmtNum(r.a?.dias_desconto)}
                  </td>
                  <td className="py-2 px-3 text-xs text-slate-400 max-w-[160px] truncate">
                    {r.a?.arquivo_origem ?? "—"}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={12} className="py-4 px-3 text-slate-500 dark:text-slate-400">
                    Nenhum funcionário encontrado com esse filtro.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
