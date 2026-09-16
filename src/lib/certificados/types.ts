// `norma` é o TIPO/categoria do certificado (agrupa a lista de funções):
// NR05, NR07, NR10, NR12, NR17, NR20, NR23, NR33, NR34, NR35, FISPQ,
// Profissionalizante, etc. Texto livre.
export type NormaCertificado = string;
export type TipoTreinamento = "inicial" | "periodico";
export type DocTipo = "CPF" | "RG";

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
  // Texto da frente específico do modelo (com marcadores). Null = usa o global.
  texto_frente?: string | null;
  // Documento de identificação usado no certificado: "CPF" (padrão) ou "RG".
  doc_tipo?: DocTipo | null;
  // Assinantes (chaves separadas por vírgula): "thiago" | "thiago,demetrio" |
  // "thiago,jose". Null = "thiago".
  assinantes?: string | null;
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
