import type { Pendencia } from "./parse";

export type { Pendencia };

// Um funcionário do PDF já cruzado com rh_funcionarios e o estado atual.
export type FuncionarioPreview = {
  matricula: string;
  nome: string; // nome como veio no holerite
  cpf: string;
  paginas: number[]; // 0-based
  liquido: number | null;
  adiantamento: number | null;
  devolucao: number | null;
  funcionarioId: string | null;
  nomeSistema: string | null; // nome em rh_funcionarios
  statusSistema: string | null;
  matched: boolean; // achou em rh_funcionarios pela matrícula
  jaTemAcesso: boolean; // já existe portal_acessos
  jaImportado: boolean; // já existe holerite dessa competência
};

export type ArquivoPreview = {
  arquivo: string;
  erro?: string;
  obra: string | null;
  competencia: string | null; // "AAAA-MM-01"
  totalPaginas: number;
  funcionarios: FuncionarioPreview[];
  pendentes: Pendencia[];
};

export type ParsePreviewResposta = { arquivos: ArquivoPreview[] };
