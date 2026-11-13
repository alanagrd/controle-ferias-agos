"use client";

import { useMemo, useRef, useState, useSyncExternalStore } from "react";
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
  type PeriodoStatusKey,
} from "@/lib/status";
import {
  exportarVencimentosExcel,
  exportarVencimentosPdf,
  type VencimentoRow,
} from "./exportar-vencimentos";

type Janela = "VENCIDOS" | "7" | "30" | "60" | "90";

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
  obra: string | null;
};

/** Afastado/abandono: a obra (centro de custo) contém "AFASTAD" ou "ABANDON".
 *  Esse pessoal naturalmente fica com férias vencidas, então separamos. */
function isAfastado(obra: string | null | undefined): boolean {
  return !!obra && /AFASTAD|ABANDON/i.test(obra);
}

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
    let vencidosAfastados = 0;
    let vencidosTrabalhando = 0;
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
    const detalhes: {
      id: string;
      nome: string;
      cliente: string;
      obra: string;
      dataLimite: string;
      saldo: number;
      dias: number;
      statusKey: PeriodoStatusKey;
      statusLabel: string;
      afastado: boolean;
    }[] = [];

    periodos.forEach((p) => {
      const f = funcionarioById[p.funcionario_id];
      if (!f) return;
      if (cliente && f.cliente_razao_social !== cliente) return;

      const statusKey = PERIODO_STATUS_MAP[p.status];
      const clienteKey = f.cliente_razao_social || "Sem cliente";
      const afastado = isAfastado(f.obra);

      statusCount[statusKey] = (statusCount[statusKey] || 0) + 1;

      if (statusKey === "VENCIDO") {
        vencidos++;
        if (afastado) vencidosAfastados++;
        else vencidosTrabalhando++;
      }

      const dias = daysBetween(p.data_limite);
      if (dias >= 0 && dias <= 7 && p.saldo > 0) prox7++;
      if (dias >= 0 && dias <= 30 && p.saldo > 0) prox30++;
      if (dias >= 0 && dias <= 60 && p.saldo > 0) prox60++;
      if (dias >= 0 && dias <= 90 && p.saldo > 0) prox90++;

      detalhes.push({
        id: p.id,
        nome: f.nome,
        cliente: clienteKey,
        obra: f.obra || "",
        dataLimite: p.data_limite,
        saldo: p.saldo,
        dias,
        statusKey,
        statusLabel: PERIODO_STATUS_LABEL[statusKey],
        afastado,
      });
    });

    return {
      ativos,
      vencidos,
      vencidosAfastados,
      vencidosTrabalhando,
      prox7,
      prox30,
      prox60,
      prox90,
      statusCount,
      detalhes,
    };
  }, [funcionarios, periodos, cliente, funcionarioById]);

  // janela da lista (controlada pelos cards e pelo seletor)
  const [janela, setJanela] = useState<Janela>("60");
  const [exportando, setExportando] = useState<null | "xlsx" | "pdf">(null);
  const listaRef = useRef<HTMLDivElement>(null);

  const janelaInfo = useMemo(
    () =>
      janela === "VENCIDOS"
        ? { label: "Períodos vencidos", slug: "vencidos" }
        : { label: `Vencem em até ${janela} dias`, slug: `${janela}dias` },
    [janela]
  );

  const listaFiltrada = useMemo(() => {
    const base = stats.detalhes;
    const arr =
      janela === "VENCIDOS"
        ? base.filter((d) => d.statusKey === "VENCIDO")
        : base.filter((d) => {
            const n = Number(janela);
            return d.dias >= 0 && d.dias <= n && d.saldo > 0;
          });
    return arr.slice().sort((a, b) => a.dias - b.dias);
  }, [stats.detalhes, janela]);

  function irParaLista(j: Janela) {
    setJanela(j);
    requestAnimationFrame(() =>
      listaRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
    );
  }

  async function baixar(tipo: "xlsx" | "pdf") {
    setExportando(tipo);
    try {
      const rows: VencimentoRow[] = listaFiltrada.map((d) => ({
        nome: d.nome,
        cliente: d.cliente,
        obra: d.obra,
        dataLimite: d.dataLimite,
        dias: d.dias,
        saldo: d.saldo,
        statusLabel: d.statusLabel,
        afastado: d.afastado,
      }));
      const meta = {
        cliente: cliente || "Todos",
        janelaLabel: janelaInfo.label,
        janelaSlug: janelaInfo.slug,
        geradoEm: new Date(),
        resumo: {
          vencidosTrabalhando: stats.vencidosTrabalhando,
          vencidosAfastados: stats.vencidosAfastados,
          prox7: stats.prox7,
          prox30: stats.prox30,
          prox60: stats.prox60,
          prox90: stats.prox90,
        },
      };
      if (tipo === "xlsx") await exportarVencimentosExcel(rows, meta);
      else await exportarVencimentosPdf(rows, meta);
    } catch (e) {
      alert("Erro ao exportar: " + (e as Error).message);
    } finally {
      setExportando(null);
    }
  }

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
        <Kpi
          label="Períodos vencidos"
          value={stats.vencidosTrabalhando}
          tone="danger"
          sub={`+ ${stats.vencidosAfastados.toLocaleString(
            "pt-BR"
          )} afastados/abandono (${stats.vencidos.toLocaleString(
            "pt-BR"
          )} no total)`}
          onClick={() => irParaLista("VENCIDOS")}
          active={janela === "VENCIDOS"}
        />
        <Kpi
          label="Vencem em 30 dias"
          value={stats.prox30}
          tone="danger"
          onClick={() => irParaLista("30")}
          active={janela === "30"}
        />
        <Kpi
          label="Vencem em 60 dias"
          value={stats.prox60}
          tone="warn"
          onClick={() => irParaLista("60")}
          active={janela === "60"}
        />
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

      <div
        ref={listaRef}
        className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 scroll-mt-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <h2 className="text-[14.5px] font-semibold text-slate-900 dark:text-slate-100">
            {janelaInfo.label}{" "}
            <span className="text-slate-500 dark:text-slate-400 font-normal">
              ({listaFiltrada.length})
            </span>
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            {/* seletor de janela */}
            <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
              {(
                [
                  ["VENCIDOS", "Vencidos"],
                  ["7", "7d"],
                  ["30", "30d"],
                  ["60", "60d"],
                  ["90", "90d"],
                ] as [Janela, string][]
              ).map(([j, lbl]) => (
                <button
                  key={j}
                  type="button"
                  onClick={() => setJanela(j)}
                  className={`px-2.5 py-1 text-xs ${
                    janela === j
                      ? "bg-agos-green text-white"
                      : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                  }`}
                >
                  {lbl}
                </button>
              ))}
            </div>
            {/* exportar */}
            <button
              type="button"
              disabled={exportando !== null || listaFiltrada.length === 0}
              onClick={() => baixar("xlsx")}
              className="text-xs rounded-lg bg-emerald-600 px-3 py-1.5 font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {exportando === "xlsx" ? "Gerando..." : "Exportar Excel"}
            </button>
            <button
              type="button"
              disabled={exportando !== null || listaFiltrada.length === 0}
              onClick={() => baixar("pdf")}
              className="text-xs rounded-lg bg-red-600 px-3 py-1.5 font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              {exportando === "pdf" ? "Gerando..." : "Exportar PDF"}
            </button>
          </div>
        </div>
        <div className="overflow-x-auto max-h-[360px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-white dark:bg-slate-900">
              <tr className="text-left text-xs text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                <th className="py-2 font-medium">Nome</th>
                <th className="py-2 font-medium">Cliente</th>
                <th className="py-2 font-medium">Vence em</th>
                <th className="py-2 font-medium">Saldo</th>
                <th className="py-2 font-medium">Situação</th>
              </tr>
            </thead>
            <tbody>
              {listaFiltrada.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="py-3 text-sm text-slate-500 dark:text-slate-400"
                  >
                    Nenhum período nesta faixa com o filtro atual.
                  </td>
                </tr>
              ) : (
                listaFiltrada.map((p) => (
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
                      <span
                        className={`text-xs ${
                          p.dias < 0
                            ? "text-red-600 dark:text-red-400"
                            : "text-slate-500 dark:text-slate-400"
                        }`}
                      >
                        ({p.dias}d)
                      </span>
                    </td>
                    <td className="py-1.5 text-slate-700 dark:text-slate-300">
                      {p.saldo}
                    </td>
                    <td className="py-1.5">
                      {p.afastado ? (
                        <span className="text-xs px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                          Afastado/abandono
                        </span>
                      ) : (
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          Trabalhando
                        </span>
                      )}
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
  sub,
  onClick,
  active,
}: {
  label: string;
  value: number;
  tone: "default" | "warn" | "danger";
  sub?: string;
  onClick?: () => void;
  active?: boolean;
}) {
  const toneClass =
    tone === "danger"
      ? "text-red-600 dark:text-red-400"
      : tone === "warn"
      ? "text-amber-600 dark:text-amber-400"
      : "text-slate-900 dark:text-slate-100";

  const baseClass =
    "bg-white dark:bg-slate-900 rounded-xl border p-4 text-left w-full transition";
  const borderClass = active
    ? "border-agos-green ring-1 ring-agos-green"
    : "border-slate-200 dark:border-slate-800";
  const interactiveClass = onClick
    ? "cursor-pointer hover:border-agos-green hover:shadow-sm"
    : "";

  const content = (
    <>
      <p className="text-[12px] uppercase tracking-wide text-slate-500 dark:text-slate-400 flex items-center gap-1">
        {label}
        {onClick && <span aria-hidden className="text-slate-400">›</span>}
      </p>
      <p className={`text-[26px] font-bold mt-1.5 ${toneClass}`}>
        {value.toLocaleString("pt-BR")}
      </p>
      {sub && (
        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-tight">
          {sub}
        </p>
      )}
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`${baseClass} ${borderClass} ${interactiveClass}`}
      >
        {content}
      </button>
    );
  }
  return <div className={`${baseClass} ${borderClass}`}>{content}</div>;
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
