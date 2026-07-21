"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useTheme } from "next-themes";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Tooltip,
  Legend,
} from "chart.js";
import { Bar, Doughnut } from "react-chartjs-2";
import type { StatusFuncionario, StatusPeriodo } from "@/lib/types";
import {
  PERIODO_STATUS_COLOR,
  PERIODO_STATUS_LABEL,
  PERIODO_STATUS_MAP,
  PERIODO_STATUS_ORDER,
  daysBetween,
  fmtDate,
} from "@/lib/status";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Tooltip,
  Legend
);

type FuncionarioLite = {
  id: string;
  nome: string;
  status: StatusFuncionario;
  cliente_razao_social: string | null;
};

type PeriodoLite = {
  id: string;
  funcionario_id: string;
  data_limite: string;
  saldo: number;
  status: StatusPeriodo;
};

export default function DashboardClient({
  funcionarios,
  periodos,
}: {
  funcionarios: FuncionarioLite[];
  periodos: PeriodoLite[];
}) {
  const [cliente, setCliente] = useState("");

  const funcionarioById = useMemo(
    () => Object.fromEntries(funcionarios.map((f) => [f.id, f])),
    [funcionarios]
  );

  const clientes = useMemo(
    () =>
      Array.from(
        new Set(
          funcionarios
            .map((f) => f.cliente_razao_social)
            .filter((c): c is string => !!c)
        )
      ).sort((a, b) => a.localeCompare(b, "pt-BR")),
    [funcionarios]
  );

  const stats = useMemo(() => {
    const funcionariosFiltrados = funcionarios.filter(
      (f) => !cliente || f.cliente_razao_social === cliente
    );
    const ativos = new Set(
      funcionariosFiltrados.filter((f) => f.status === "ATIVO").map((f) => f.nome)
    ).size;

    let vencidos = 0;
    let prox7 = 0;
    let prox30 = 0;
    let prox60 = 0;
    let prox90 = 0;
    const statusCount: Record<string, number> = {
      EM_ABERTO: 0,
      PARCIALMENTE_GOZADO: 0,
      VENCIDO: 0,
      INTEGRALMENTE_GOZADO: 0,
    };
    const proximos: {
      id: string;
      nome: string;
      cliente: string;
      dataLimite: string;
      saldo: number;
      dias: number;
    }[] = [];

    periodos.forEach((p) => {
      const f = funcionarioById[p.funcionario_id];
      if (!f) return;
      if (cliente && f.cliente_razao_social !== cliente) return;

      const statusKey = PERIODO_STATUS_MAP[p.status];
      const clienteKey = f.cliente_razao_social || "Sem cliente";

      statusCount[statusKey] = (statusCount[statusKey] || 0) + 1;

      if (statusKey === "VENCIDO") vencidos++;

      const dias = daysBetween(p.data_limite);
      if (dias >= 0 && dias <= 7 && p.saldo > 0) prox7++;
      if (dias >= 0 && dias <= 30 && p.saldo > 0) prox30++;
      if (dias >= 0 && dias <= 60 && p.saldo > 0) prox60++;
      if (dias >= 0 && dias <= 90 && p.saldo > 0) prox90++;
      if (dias >= 0 && dias <= 60 && p.saldo > 0) {
        proximos.push({
          id: p.id,
          nome: f.nome,
          cliente: clienteKey,
          dataLimite: p.data_limite,
          saldo: p.saldo,
          dias,
        });
      }
    });

    proximos.sort((a, b) => a.dias - b.dias);

    return {
      ativos,
      vencidos,
      prox7,
      prox30,
      prox60,
      prox90,
      statusCount,
      proximos,
    };
  }, [funcionarios, periodos, cliente, funcionarioById]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
          Dashboard
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Visão geral de férias e vencimentos.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <label className="block">
          <span className="block text-[11.5px] uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1">
            Cliente
          </span>
          <select
            value={cliente}
            onChange={(e) => setCliente(e.target.value)}
            className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 px-3 py-1.5 text-sm min-w-[150px]"
          >
            <option value="">Todos</option>
            {clientes.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Kpi label="Funcionários ativos" value={stats.ativos} tone="default" />
        <Kpi label="Períodos vencidos" value={stats.vencidos} tone="danger" />
        <Kpi label="Vencem em 30 dias" value={stats.prox30} tone="danger" />
        <Kpi label="Vencem em 60 dias" value={stats.prox60} tone="warn" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.3fr_1fr] gap-4">
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5">
          <h2 className="text-[14.5px] font-semibold text-slate-900 dark:text-slate-100 mb-3">
            Férias a vencer
          </h2>
          <div style={{ height: 230 }}>
            <VencimentosBarChart
              counts={{
                d7: stats.prox7,
                d30: stats.prox30,
                d60: stats.prox60,
                d90: stats.prox90,
              }}
            />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5">
          <h2 className="text-[14.5px] font-semibold text-slate-900 dark:text-slate-100 mb-3">
            Status dos períodos{" "}
            <span className="text-slate-500 dark:text-slate-400 font-normal">
              (geral)
            </span>
          </h2>
          <div style={{ height: 230, maxWidth: 230, margin: "0 auto" }}>
            <StatusDoughnutChart statusCount={stats.statusCount} />
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5">
        <h2 className="text-[14.5px] font-semibold text-slate-900 dark:text-slate-100 mb-3">
          Próximos vencimentos (60 dias)
        </h2>
        <div className="overflow-x-auto max-h-[280px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-white dark:bg-slate-900">
              <tr className="text-left text-xs text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                <th className="py-2 font-medium">Nome</th>
                <th className="py-2 font-medium">Cliente</th>
                <th className="py-2 font-medium">Vence em</th>
                <th className="py-2 font-medium">Saldo</th>
              </tr>
            </thead>
            <tbody>
              {stats.proximos.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="py-3 text-sm text-slate-500 dark:text-slate-400"
                  >
                    Nenhum vencimento próximo com este filtro.
                  </td>
                </tr>
              ) : (
                stats.proximos.slice(0, 25).map((p) => (
                  <tr
                    key={p.id}
                    className="border-b border-slate-50 dark:border-slate-800/60 hover:bg-slate-50 dark:hover:bg-slate-800/60"
                  >
                    <td className="py-1.5">
                      <Link
                        href={`/funcionarios?q=${encodeURIComponent(p.nome)}`}
                        className="text-agos-green-dark dark:text-agos-green-light hover:underline"
                      >
                        {p.nome}
                      </Link>
                    </td>
                    <td className="py-1.5 text-slate-700 dark:text-slate-300">
                      {p.cliente}
                    </td>
                    <td className="py-1.5 text-slate-700 dark:text-slate-300">
                      {fmtDate(p.dataLimite)}{" "}
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        ({p.dias}d)
                      </span>
                    </td>
                    <td className="py-1.5 text-slate-700 dark:text-slate-300">
                      {p.saldo}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Kpi({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "default" | "warn" | "danger";
}) {
  const toneClass =
    tone === "danger"
      ? "text-red-600 dark:text-red-400"
      : tone === "warn"
      ? "text-amber-600 dark:text-amber-400"
      : "text-slate-900 dark:text-slate-100";
  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4">
      <p className="text-[12px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {label}
      </p>
      <p className={`text-[26px] font-bold mt-1.5 ${toneClass}`}>
        {value.toLocaleString("pt-BR")}
      </p>
    </div>
  );
}

function useChartTheme() {
  const { theme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const isDark = theme === "dark";
  return {
    mounted,
    isDark,
    textColor: isDark ? "#cbd5e1" : "#475569",
    mutedColor: isDark ? "#9aa3b2" : "#6b7280",
    gridColor: isDark ? "rgba(148,163,184,0.15)" : "rgba(15,23,42,0.08)",
  };
}

/**
 * Contagens de "quantas férias vencem em até N dias" (`d90` inclui os já
 * contados em `d60`/`d30`/`d7` — mesma semântica cumulativa dos KPIs
 * "Vencem em 30/60 dias" acima). Cores em gradiente de urgência: vermelho
 * (7d, mesmo tom de VENCIDO) → laranja AGOS → âmbar (mesmo tom de
 * PARCIALMENTE_GOZADO) → verde AGOS (90d, ainda com folga).
 */
function VencimentosBarChart({
  counts,
}: {
  counts: { d7: number; d30: number; d60: number; d90: number };
}) {
  const { mounted, mutedColor, gridColor } = useChartTheme();
  if (!mounted) return null;

  const labels = ["Até 7 dias", "Até 30 dias", "Até 60 dias", "Até 90 dias"];
  const data = [counts.d7, counts.d30, counts.d60, counts.d90];
  const colors = ["#f0546b", "#E87722", "#f5a623", "#8BAB3E"];

  return (
    <Bar
      data={{
        labels,
        datasets: [
          {
            label: "Períodos com saldo a vencer",
            data,
            backgroundColor: colors,
            borderRadius: 6,
          },
        ],
      }}
      options={{
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            ticks: { color: mutedColor, font: { size: 11 } },
            grid: { display: false },
          },
          y: {
            beginAtZero: true,
            ticks: { color: mutedColor, precision: 0 },
            grid: { color: gridColor },
          },
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => ` ${ctx.parsed.y} período(s)`,
            },
          },
        },
      }}
    />
  );
}

function StatusDoughnutChart({
  statusCount,
}: {
  statusCount: Record<string, number>;
}) {
  const { mounted, textColor } = useChartTheme();
  if (!mounted) return null;

  return (
    <Doughnut
      data={{
        labels: PERIODO_STATUS_ORDER.map((k) => PERIODO_STATUS_LABEL[k]),
        datasets: [
          {
            data: PERIODO_STATUS_ORDER.map((k) => statusCount[k] || 0),
            backgroundColor: PERIODO_STATUS_ORDER.map(
              (k) => PERIODO_STATUS_COLOR[k]
            ),
            borderWidth: 0,
          },
        ],
      }}
      options={{
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: "bottom" as const,
            labels: { color: textColor, boxWidth: 11, font: { size: 11 } },
          },
        },
      }}
    />
  );
}
