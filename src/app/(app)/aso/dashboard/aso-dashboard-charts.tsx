"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
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
import type { StatusFuncionario, VAso } from "@/lib/types";
import { ASO_STATUS_COLOR, ASO_STATUS_LABEL } from "@/lib/status-aso";
import { fmtDate } from "@/lib/status";

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

export default function AsoDashboardClient({
  funcionarios,
  registros,
}: {
  funcionarios: FuncionarioLite[];
  registros: VAso[];
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
    let vencidos = 0;
    let prox7 = 0;
    let prox30 = 0;
    let prox60 = 0;
    let prox90 = 0;
    const statusCount: Record<string, number> = { valido: 0, vencido: 0 };
    const proximos: {
      id: string;
      nome: string;
      cliente: string;
      vencimento: string;
      dias: number;
      status: "valido" | "vencido";
    }[] = [];

    let ativosContados = 0;

    registros.forEach((r) => {
      const f = funcionarioById[r.funcionario_id];
      if (!f) return;
      if (cliente && f.cliente_razao_social !== cliente) return;

      ativosContados++;
      statusCount[r.status] = (statusCount[r.status] || 0) + 1;
      if (r.status === "vencido") vencidos++;

      const dias = r.dias_para_vencer;
      if (dias >= 0 && dias <= 7) prox7++;
      if (dias >= 0 && dias <= 30) prox30++;
      if (dias >= 0 && dias <= 60) prox60++;
      if (dias >= 0 && dias <= 90) prox90++;

      if (dias >= 0 && dias <= 60) {
        proximos.push({
          id: r.registro_id,
          nome: f.nome,
          cliente: f.cliente_razao_social || "Sem cliente",
          vencimento: r.data_vencimento,
          dias,
          status: r.status,
        });
      }
    });

    proximos.sort((a, b) => a.dias - b.dias);

    return {
      ativos: ativosContados,
      vencidos,
      prox7,
      prox30,
      prox60,
      prox90,
      statusCount,
      proximos,
    };
  }, [registros, cliente, funcionarioById]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
          Dashboard ASO
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Visão geral de exames ocupacionais e vencimentos.
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
        <Kpi label="Funcionários ativos (ASO)" value={stats.ativos} tone="default" />
        <Kpi label="ASOs vencidos" value={stats.vencidos} tone="danger" />
        <Kpi label="Vencem em 30 dias" value={stats.prox30} tone="danger" />
        <Kpi label="Vencem em 60 dias" value={stats.prox60} tone="warn" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.3fr_1fr] gap-4">
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5">
          <h2 className="text-[14.5px] font-semibold text-slate-900 dark:text-slate-100 mb-3">
            ASOs a vencer
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
            Status dos ASOs{" "}
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
                <th className="py-2 font-medium">Status</th>
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
                        href={`/aso/funcionarios?q=${encodeURIComponent(p.nome)}`}
                        className="text-agos-green-dark dark:text-agos-green-light hover:underline"
                      >
                        {p.nome}
                      </Link>
                    </td>
                    <td className="py-1.5 text-slate-700 dark:text-slate-300">
                      {p.cliente}
                    </td>
                    <td className="py-1.5 text-slate-700 dark:text-slate-300">
                      {fmtDate(p.vencimento)}{" "}
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        ({p.dias}d)
                      </span>
                    </td>
                    <td className="py-1.5">
                      <span
                        className="text-xs font-semibold px-2 py-0.5 rounded-full"
                        style={{
                          color: ASO_STATUS_COLOR[p.status],
                          backgroundColor: `${ASO_STATUS_COLOR[p.status]}1a`,
                        }}
                      >
                        {ASO_STATUS_LABEL[p.status]}
                      </span>
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

const emptySubscribe = () => () => {};

function useChartTheme() {
  const { theme } = useTheme();
  // Detecta hidratação sem setState em effect (evita mismatch de SSR do next-themes).
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
    mutedColor: isDark ? "#9aa3b2" : "#6b7280",
    gridColor: isDark ? "rgba(148,163,184,0.15)" : "rgba(15,23,42,0.08)",
  };
}

/**
 * Mesma semântica cumulativa e gradiente de urgência usados no gráfico
 * "Férias a vencer" (vermelho -> laranja AGOS -> âmbar -> verde AGOS).
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
            label: "ASOs a vencer",
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

  const order: ("valido" | "vencido")[] = ["valido", "vencido"];

  return (
    <Doughnut
      data={{
        labels: order.map((k) => ASO_STATUS_LABEL[k]),
        datasets: [
          {
            data: order.map((k) => statusCount[k] || 0),
            backgroundColor: order.map((k) => ASO_STATUS_COLOR[k]),
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
