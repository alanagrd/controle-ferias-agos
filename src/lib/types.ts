export type StatusFuncionario = "ATIVO" | "INATIVO" | "REVISAR";
export type StatusPagamento = "PAGO" | "PENDENTE";
export type StatusPeriodo = "aberto" | "parcial" | "integral" | "vencido";

export type Empresa = {
  id: string;
  nome: string;
  ativa?: boolean;
};

export type Funcionario = {
  id: string;
  codigo: string | null;
  nome: string;
  empresa_id: string | null;
  obra: string | null;
  setor: string | null;
  cargo: string | null;
  admissao: string | null;
  demissao: string | null;
  status: StatusFuncionario;
  cliente_codigo: string | null;
  cliente_razao_social: string | null;
  criado_em?: string;
  atualizado_em?: string;
  rh_empresas?: Empresa | null;
};

export type PeriodoAquisitivo = {
  id: string;
  funcionario_id: string;
  inicio: string;
  fim: string;
  dias_direito: number;
  data_limite: string;
};

export type LancamentoFerias = {
  id: string;
  periodo_id: string;
  inicio: string;
  fim: string;
  dias: number;
  status_pagamento: StatusPagamento;
  data_pagamento: string | null;
  processado_por: string | null;
  observacao: string | null;
  criado_em: string;
};

export type VPeriodo = PeriodoAquisitivo & {
  funcionario_id: string;
  dias_gozados: number;
  saldo: number;
  status: StatusPeriodo;
};

export type StatusAso = "valido" | "vencido";
export type TipoAso =
  | "ADMISSIONAL"
  | "PERIODICO"
  | "RETORNO_AO_TRABALHO"
  | "MUDANCA_DE_RISCO"
  | "DEMISSIONAL";

export type RegistroAso = {
  id: string;
  funcionario_id: string;
  data_aso: string;
  tipo: TipoAso;
  data_vencimento: string;
  observacao: string | null;
  criado_em?: string;
};

/** view v_rh_aso: registro de ASO vigente (mais recente) por funcionário ativo. */
export type VAso = {
  funcionario_id: string;
  registro_id: string;
  data_aso: string;
  tipo: TipoAso;
  data_vencimento: string;
  dias_para_vencer: number;
  status: StatusAso;
};

// ---- Módulo VT (Vale Transporte) ----

export type StatusCompetencia = "ABERTA" | "FECHADA";
export type StatusFuncionarioMes = "ATIVO" | "DISPENSADO";
export type TipoVt = "DIARIO" | "MENSAL";

export type Competencia = {
  id: string;
  ano: number;
  mes: number;
  status: StatusCompetencia;
  criado_em?: string;
  atualizado_em?: string;
};

export type FuncionarioCompetencia = {
  id: string;
  funcionario_id: string;
  competencia_id: string;
  obra_snapshot: string | null;
  status_no_mes: StatusFuncionarioMes;
  tipo_vt: TipoVt;
  valor_diario: number | null;
  dias_uteis: number | null;
  valor_total: number;
  /** Valor de VR pago no mês — controlado junto com o VT, reembolso via vt_lancamentos. */
  vr_valor: number | null;
  criado_em?: string;
  atualizado_em?: string;
};

export type LancamentoVt = {
  id: string;
  func_comp_id: string;
  data: string;
  valor: number;
  motivo: string | null;
  cobrado_cliente: boolean;
  criado_em?: string;
};

export type ApontamentoVt = {
  id: string;
  func_comp_id: string;
  h50: number;
  h70: number;
  h100: number;
  faltas: number;
  dsr: number;
  ad_not: number;
  premio: number;
  /** Dias de reembolso VT (Sabados, ou Total M.A quando Sabados vem vazio). */
  dias_reembolso: number;
  /** Dias de desconto VT (QTD Desc VT) — usado no cálculo do fechamento. */
  dias_desconto: number;
  /** dias_reembolso x valor_diario, calculado e gravado na importação. */
  valor_reembolso: number;
  /** dias_desconto x valor_diario, calculado e gravado na importação. */
  valor_desconto: number;
  /** Valor da Cesta Básica (R$) importado da planilha de ponto (coluna Cesta Básica). */
  cesta_basica: number | null;
  /** Reembolso de VR ao funcionário (R$) — coluna Vr M.A da planilha de ponto. */
  reembolso_vr: number | null;
  arquivo_origem: string | null;
  importado_em?: string;
};

/** Linha combinada usada nas telas: funcionário + snapshot da competência atual. */
export type VtFuncionarioRow = {
  funcComp: FuncionarioCompetencia;
  funcionario: Pick<Funcionario, "id" | "nome" | "codigo" | "cliente_razao_social" | "status">;
};
