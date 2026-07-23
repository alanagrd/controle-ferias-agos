export type StatusAso = "valido" | "vencido";
export type TipoAso =
  | "ADMISSIONAL"
  | "PERIODICO"
  | "RETORNO_AO_TRABALHO"
  | "MUDANCA_DE_RISCO"
  | "DEMISSIONAL";

export const ASO_STATUS_LABEL: Record<StatusAso, string> = {
  valido: "Válido",
  vencido: "Vencido",
};

/** Mesmos tons já usados em Férias: verde AGOS/emerald para ok, vermelho para vencido. */
export const ASO_STATUS_BADGE_CLASS: Record<StatusAso, string> = {
  valido: "bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400",
  vencido: "bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-400",
};

/** Mesmo hex de VENCIDO/INTEGRALMENTE_GOZADO em status.ts, para consistência entre módulos. */
export const ASO_STATUS_COLOR: Record<StatusAso, string> = {
  valido: "#3ecf8e",
  vencido: "#f0546b",
};

export const TIPO_ASO_LABEL: Record<TipoAso, string> = {
  ADMISSIONAL: "Admissional",
  PERIODICO: "Periódico",
  RETORNO_AO_TRABALHO: "Retorno ao Trabalho",
  MUDANCA_DE_RISCO: "Mudança de Risco",
  DEMISSIONAL: "Demissional",
};
