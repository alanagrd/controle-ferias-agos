export type NormaCertificado = "NR35" | "NR12";
export type TipoTreinamento = "inicial" | "periodico";

export type CertificadoModelo = {
  id: string;
  norma: NormaCertificado;
  nome_funcao: string;
  nome_curso: string;
  normas_aplicaveis: string;
  carga_horaria: number;
  tipo: TipoTreinamento;
  conteudo_programatico: string;
  ativo: boolean;
  created_at?: string;
};

export type CertificadoEmitido = {
  id: string;
  modelo_id: string;
  nome_funcionario: string;
  cpf: string;
  cidade: string;
  data_treinamento: string;
  data_treinamento_fim: string | null;
  emitido_em: string;
  certificados_modelos?: CertificadoModelo | null;
};

export type DadosEmissao = {
  nome_funcionario: string;
  cpf: string;
  cidade: string;
  data_treinamento: string;
  data_treinamento_fim?: string | null;
};
