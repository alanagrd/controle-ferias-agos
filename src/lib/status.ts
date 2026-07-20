import type { StatusPeriodo } from "./types";

export type PeriodoStatusKey =
  | "EM_ABERTO"
  | "PARCIALMENTE_GOZADO"
  | "VENCIDO"
  | "INTEGRALMENTE_GOZADO";

/** DB (v_rh_periodos.status) -> prototype UPPER_SNAKE_CASE key. */
export const PERIODO_STATUS_MAP: Record<StatusPeriodo, PeriodoStatusKey> = {
  aberto: "EM_ABERTO",
  parcial: "PARCIALMENTE_GOZADO",
  vencido: "VENCIDO",
  integral: "INTEGRALMENTE_GOZADO",
};

/** Short label used in badges and chart legends (matches prototype STATUS_LABEL). */
export const PERIODO_STATUS_LABEL: Record<PeriodoStatusKey, string> = {
  EM_ABERTO: "Em aberto",
  PARCIALMENTE_GOZADO: "Parcial",
  VENCIDO: "Vencido",
  INTEGRALMENTE_GOZADO: "Integral",
};

/** Longer label used in the "Status do período" filter dropdown (matches prototype select options). */
export const PERIODO_STATUS_LABEL_LONG: Record<PeriodoStatusKey, string> = {
  EM_ABERTO: "Em aberto",
  PARCIALMENTE_GOZADO: "Parcialmente gozado",
  VENCIDO: "Vencido",
  INTEGRALMENTE_GOZADO: "Integralmente gozado",
};

export const PERIODO_STATUS_ORDER: PeriodoStatusKey[] = [
  "EM_ABERTO",
  "PARCIALMENTE_GOZADO",
  "VENCIDO",
  "INTEGRALMENTE_GOZADO",
];

/** Chart/badge colors, matching prototype's dark-mode hex values (used in both themes). */
export const PERIODO_STATUS_COLOR: Record<PeriodoStatusKey, string> = {
  EM_ABERTO: "#5b8cff",
  PARCIALMENTE_GOZADO: "#f5a623",
  VENCIDO: "#f0546b",
  INTEGRALMENTE_GOZADO: "#3ecf8e",
};

export const PERIODO_STATUS_BADGE_CLASS: Record<PeriodoStatusKey, string> = {
  EM_ABERTO:
    "bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-400",
  PARCIALMENTE_GOZADO:
    "bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-400",
  VENCIDO: "bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-400",
  INTEGRALMENTE_GOZADO:
    "bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400",
};

/** Days between today (midnight) and the given ISO date (YYYY-MM-DD). Positive = future. */
export function daysBetween(iso: string): number {
  const target = new Date(iso + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

/** Formats an ISO date (YYYY-MM-DD) as dd/mm/yyyy, matching prototype fmtDate(). */
export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "–";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}
