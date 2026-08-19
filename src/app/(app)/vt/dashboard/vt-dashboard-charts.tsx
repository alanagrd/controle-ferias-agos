"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useTheme } from "next-themes";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend,
} from "chart.js";
import { Bar } from "react-chartjs-2";
import type {
  ApontamentoVt,
  Competencia,
  FuncionarioCompetencia,
  LancamentoVt,
} from "@/lib/types";
import {
  COMPETENCIA_STATUS_BADGE_CLASS,
  COMPETENCIA_STATUS_LABEL,
  fmtMoeda,
  nomeCompetencia,
} from "@/lib/status-vt";

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

const emptySubscribe = () => () => {};

function useChartTheme() {
  const { theme } = useTheme();
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
  const isDark = theme === "dark";
  return {
    mounted,
    isDark,
    textColor: isDark ? "#cbd5e1" : "#475569",
    gridColor: isDark ? "rgba(148,163,184,0.15)" : "rgba(15,23,42,0.08)",
  };
}

function Kpi({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4">
      <p className="text-[12px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {label}
      </p>
      <p className="text-[24px] font-bold mt-1.5 text-slate-900 dark:text-slate-100">
        {value}
      </p>
      {sub && (
        <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
          {sub}
        </p>
      )}
    </div>
  );
}

type FuncCompLite = Pick<
  FuncionarioCompetencia,
  | "id"
  | "funcionario_id"
  | "competencia_id"
  | "obra_snapshot"
  | "status_no_mes"
  | "tipo_vt"
  | "valor_diario"
  | "dias_uteis"
  | "valor_total"
>;

export default function VtDashboardClient({
  competencias,
  competenciaAtual,
  funcComp,
  apontamentos,
  lancamentos,
}: {
  competencias: Competencia[];
  competenciaAtual: Competencia | null;
  funcComp: FuncCompLite[];
  apontamentos: ApontamentoVt[];
  lancamentos: LancamentoVt[];
}) {
  const { mounted, textColor, gridColor } = useChartTheme();
  const [competenciaId, setCompetenciaId] = useState(competenciaAtual?.id ?? "");

  const competenciaSelecionada =
    competencias.find((c) => c.id === competenciaId) ?? competenciaAtual;

  const totalVt = useMemo(
    () => funcComp.reduce((acc, fc) => acc + (fc.valor_total ?? 0), 0),
    [funcComp]
  );

  const apontamentoImportadoIds = useMemo(() => {
    const ids = new Set<string>();
    apontamentos.forEach((a) => {
      const preenchido =
        a.h50 || a.h70 || a.h100 || a.faltas || a.dsr || a.ad_not || a.premio;
      if (preenchido) ids.add(a.func_comp_id);
    });
    return ids;
  }, [apontamentos]);

  const pctApontamento =
    funcComp.length === 0
      ? 0
      : Math.round((apontamentoImportadoIds.size / funcComp.length) * 100);

  const porObra = useMemo(() => {
    const map = new Map<string, number>();
    funcComp.forEach((fc) => {
      const obra = fc.obra_snapshot ?? "Sem obra";
      map.set(obra, (map.get(obra) ?? 0) + (fc.valor_total ?? 0));
    });
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
  }, [funcComp]);

  if (!competenciaAtual) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-8 text-center">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Nenhuma competência de VT foi aberta ainda.
        </p>
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
          Abra a competência do mês em{" "}
          <Link
            href="/vt/funcionarios"
            className="text-agos-green-dark dark:text-agos-green-light hover:underline"
          >
            Funcionários & VT
          </Link>
          .
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
          Vale Transporte — Visão geral
        </h1>
        <div className="flex items-center gap-2">
          <select
            className="input w-auto"
            value={competenciaId || competenciaAtual.id}
            onChange={(e) => setCompetenciaId(e.target.value)}
          >
            {competencias.map((c) => (
              <option key={c.id} value={c.id}>
                {nomeCompetencia(c.ano, c.mes)}
              </option>
            ))}
          </select>
          {competenciaSelecionada && (
            <span
              className={`text-[11px] font-semibold rounded-full px-2.5 py-1 ${
                COMPETENCIA_STATUS_BADGE_CLASS[competenciaSelecionada.status]
              }`}
            >
              {COMPETENCIA_STATUS_LABEL[competenciaSelecionada.status]}
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Kpi label="Funcionários" value={funcComp.length.toLocaleString("pt-BR")} sub="na competência" />
        <Kpi label="Total VT" value={fmtMoeda(totalVt)} sub="valor consolidado" />
        <Kpi
          label="Lançamentos avulsos"
          value={lancamentos.length.toLocaleString("pt-BR")}
          sub="reembolsos e descontos"
        />
        <Kpi
          label="Apontamento importado"
          value={`${pctApontamento}%`}
          sub={`${apontamentoImportadoIds.size} de ${funcComp.length} funcionários`}
        />
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          Total de VT por obra
        </h3>
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
          10 maiores centros de custo na competência
        </p>
        <div className="mt-4 h-72">
          {mounted && (
            <Bar
              data={{
                labels: porObra.map(([obra]) => obra),
                datasets: [
                  {
                    label: "Total VT",
                    data: porObra.map(([, valor]) => valor),
                    backgroundColor: "#8bab3e",
                    borderRadius: 4,
                  },
                ],
              }}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                indexAxis: "y" as const,
                plugins: {
                  legend: { display: false },
                  tooltip: {
                    callbacks: {
                      label: (ctx) => fmtMoeda(ctx.parsed.x as number),
                    },
                  },
                },
                scales: {
                  x: {
                    ticks: { color: textColor, callback: (v) => fmtMoeda(Number(v)) },
                    grid: { color: gridColor },
                  },
                  y: {
                    ticks: { color: textColor, font: { family: "monospace", size: 11 } },
                    grid: { display: false },
                  },
                },
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
