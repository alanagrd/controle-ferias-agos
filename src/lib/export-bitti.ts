/**
 * Gera o CSV de importação do sistema Bitti (fechamento de folha), a partir
 * dos dados já no Supabase — substitui o fluxo antigo que lia direto do
 * VT_RIO.xlsx (skill `exportar-bitti`).
 *
 * Cabeçalho e "cauda fixa" (as ~38 colunas de flags/zeros específicas do
 * Bitti que vêm depois de COMPETENCIA/EMPRESA/FILIAL/FUNCIONARIO/
 * SEQUENCIAL/EVENTO/QUANTIDADE/VALOR) são sempre as mesmas em todo export
 * — confirmado com o Alan contra um CSV real (`obras_rio.csv`) — por isso
 * ficam fixas aqui, sem precisar pedir upload de um arquivo modelo toda vez.
 */

export type LinhaEventoBitti = {
  matricula: string;
  evento: number;
  tipo: "valor" | "qtd";
  valor: number;
};

export type ResumoEvento = { evento: number; descricao: string; qtd: number };

const EVENTOS_DESCRICAO: Record<number, string> = {
  276: "Total VT",
  271: "Total M.A. (reembolso VT do apontamento)",
  903: "Desconto VT",
  901: "Reembolso VT (avulso)",
  277: "Vale Refeição",
  278: "Cesta Básica",
  904: "Reembolso VR (avulso)",
  150: "Horas extras 50%",
  146: "Horas extras 70%",
  153: "Horas extras 100%",
  553: "Faltas",
  191: "Desconto DSR",
  184: "Adicional noturno",
  909: "Prêmio",
};

const EVENTOS_TIPO: Record<number, "valor" | "qtd"> = {
  276: "valor",
  271: "valor",
  903: "valor",
  901: "valor",
  277: "valor",
  278: "valor",
  904: "valor",
  150: "qtd",
  146: "qtd",
  153: "qtd",
  553: "qtd",
  191: "qtd",
  184: "qtd",
  909: "valor",
};

/** Cabeçalho fixo do CSV do Bitti (2 linhas), extraído de obras_rio.csv. */
export const HEADER_BITTI: string[] = [
  ';;;;;;;;;"Aplicar Lançamento nos seguintes cálculos ( 0-NÃO ; 1-SIM )";;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;',
  ' COMPETENCIA ; EMPRESA ; FILIAL ; FUNCIONARIO ; SEQUENCIAL ; EVENTO ; QUANTIDADE ; VALOR ; FOLHA ; RESCISÃO ; COMPLEMENTO FOLHA ; COMPLEMENTO RESCISÃO ; FÉRIAS ; COMPLEMENTO FÉRIAS ; 1ª PARCELA 13º SALÁRIO ; 2ª PARCELA 13º SALÁRIO ; DIFERENÇA 13º SALÁRIO ; ADIANTAMENTO QUINZENAL ; PLR ; ABONO ; BENEFÍCIO ;FOLHA INTERMEDIÁRIA; COLUNA VAGA ; OBSERVAÇÕES ; APLICAR TODOS OS LOTES ; LOTE DE LANÇAMENTO ; DATA DO LANÇAMENTO AAAAMMDD ; FALTAS JUSTIFICADAS ; FALTAS NÃO JUSTIFICADAS ; ATRASOS ;COLUNA VAGA; CODIGO PENSIONISTA 1 ; VALOR PENSIONISTA 1 ; CODIGO PENSIONISTA 2 ; VALOR PENSIONISTA 2 ; CODIGO PENSIONISTA 3 ; VALOR PENSIONISTA 3 ; CODIGO PENSIONISTA 4 ; VALOR PENSIONISTA 4 ; VINCULO EMPREGATICIO OUTRA EMPRESA (eSocial) ; CODIGO BENEFICIO ; MODALIDADE DO CÁLCULO DO BENEFÍCIO ;COLUNA VAGA2;COLUNA VAGA3;DATA AUSÊNCIA INÍCIO;DATA AUSÊNCIA FIM',
];

/** Cauda fixa (colunas 9 em diante de cada linha de dado), sempre igual. */
export const TAIL_BITTI =
  "1;0;0;0;0;0;0;0;0;0;0;0;0;1;0;0;0;0;;;;;;;;;;;;;;;;;;;;";

/** Rodapé fixo do CSV do Bitti (última linha, "legenda de formato" das
 * colunas) — extraído de obras_rio.csv, sempre igual em todo export. */
export const FOOTER_BITTI =
  `AAAAMM;9(03);9(02);9(06);"deixar ""0""(zero)";9(03);9(07),99;9(07),99;1;"0 ; 1";0;"0 ; 1";"0 ; 1";"0 ; 1";"0 ; 1";"0 ; 1";"0 ; 1";"0 ; 1";"0 ; 1";"0 ; 1";"0 ; 1";"0 ; 1";Deixar em branco;X(50);"N-NÃO ; S-SIM";"""zero""";AAAAMMDD;;;;;;;;;;;;;Campo ESOCIAL, LAYOUT 2.2. -  Vinculo do Funcionário na outra Empresa.;9(04);1-VT | 2-VR | 3-ALIMENTAÇÃO | 4-CESTA BÁSICA;;;AAAAMMDD;AAAAMMDD`;

/** Formata número no padrão BR (vírgula decimal, sem zeros à direita,
 * inteiros sem casas decimais) — mesma regra do script original. */
export function fmtNumBitti(v: number): string {
  if (v === 0) return "";
  if (Number.isInteger(v)) return String(v);
  const arred = Math.round(v * 100) / 100;
  return arred.toString().replace(".", ",");
}

/** Monta as linhas de dados do CSV a partir das linhas de evento já
 * calculadas, agrupadas por evento (mesmo comportamento do script: só
 * inclui quem tem valor não nulo/não zero, agrupa evento a evento). */
export function gerarLinhasCsvBitti(
  linhasEvento: LinhaEventoBitti[],
  competenciaAAAAMM: string,
  tail: string = TAIL_BITTI
): { linhas: string[]; resumo: ResumoEvento[] } {
  const porEvento = new Map<number, LinhaEventoBitti[]>();
  linhasEvento.forEach((l) => {
    if (!l.valor) return;
    const arr = porEvento.get(l.evento) ?? [];
    arr.push(l);
    porEvento.set(l.evento, arr);
  });

  const ordemEventos = [276, 271, 903, 901, 277, 278, 904, 150, 146, 153, 553, 191, 184, 909];

  const linhas: string[] = [];
  const resumo: ResumoEvento[] = [];

  ordemEventos.forEach((evento) => {
    const items = porEvento.get(evento);
    if (!items || items.length === 0) return;

    items.forEach((l) => {
      const valorFmt = fmtNumBitti(l.valor);
      const qtdCol = l.tipo === "qtd" ? valorFmt : "";
      const valorCol = l.tipo === "valor" ? valorFmt : "";
      linhas.push(
        `${competenciaAAAAMM};2;1;${l.matricula};0;${evento};${qtdCol};${valorCol};${tail}`
      );
    });

    resumo.push({
      evento,
      descricao: EVENTOS_DESCRICAO[evento] ?? String(evento),
      qtd: items.length,
    });
  });

  return { linhas, resumo };
}

export function tipoEvento(evento: number): "valor" | "qtd" {
  return EVENTOS_TIPO[evento] ?? "valor";
}

/** Dispara o download do CSV final (cabeçalho fixo + linhas novas). */
export function baixarCsvBitti(
  linhas: string[],
  nomeArquivo: string,
  header: string[] = HEADER_BITTI,
  footer: string = FOOTER_BITTI
) {
  const conteudo = [...header, ...linhas, footer].join("\r\n") + "\r\n";
  const blob = new Blob(["\uFEFF" + conteudo], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nomeArquivo;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
