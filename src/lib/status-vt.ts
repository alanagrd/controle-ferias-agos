import type { StatusCompetencia } from "@/lib/types";

export const COMPETENCIA_STATUS_LABEL: Record<StatusCompetencia, string> = {
  ABERTA: "Aberta",
  FECHADA: "Fechada",
};

/** Mesma paleta semântica do resto do app: verde AGOS para "em andamento", cinza para "encerrado". */
export const COMPETENCIA_STATUS_BADGE_CLASS: Record<StatusCompetencia, string> = {
  ABERTA:
    "bg-agos-green/10 dark:bg-agos-green/15 text-agos-green-dark dark:text-agos-green-light",
  FECHADA:
    "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400",
};

const MESES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

export function nomeCompetencia(ano: number, mes: number): string {
  return `${MESES[mes - 1] ?? mes} ${ano}`;
}

export function fmtMoeda(v: number | null | undefined): string {
  return (v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
