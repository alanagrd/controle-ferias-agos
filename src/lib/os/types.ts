export type OsRisco = { grupo: string; fatores: string[] };

export type OsModelo = {
  id: string;
  funcao: string;
  cbo: string | null;
  atividades: string | null;
  riscos: OsRisco[];
  epis: string | null;
  medidas: string[];
  ativo: boolean;
};

export type DadosOs = {
  nome: string;
  codigo: string;
  funcao: string;
  cbo: string;
  setor: string;
  cpf: string;
  admissao: string; // "YYYY-MM-DD" ou ""
  dataEmissao: string; // "YYYY-MM-DD"
};
