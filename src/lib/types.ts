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
