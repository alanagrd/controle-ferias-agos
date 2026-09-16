import type { CertificadoModelo, DadosEmissao } from "./types";

const MESES = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

/** Parses a "YYYY-MM-DD" date input value without timezone drift. */
function parseDateInput(value: string): Date {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function fmtDiaMesExtensoAno(value: string): string {
  const d = parseDateInput(value);
  return `${String(d.getDate()).padStart(2, "0")} de ${
    MESES[d.getMonth()]
  } de ${d.getFullYear()}`;
}

function fmtDDMMYYYY(value: string): string {
  const d = parseDateInput(value);
  return `${String(d.getDate()).padStart(2, "0")}/${String(
    d.getMonth() + 1
  ).padStart(2, "0")}/${d.getFullYear()}`;
}

const assetCache: Record<string, string> = {};

async function loadImageAsDataUrl(path: string): Promise<string> {
  if (assetCache[path]) return assetCache[path];
  const res = await fetch(path);
  const blob = await res.blob();
  const dataUrl: string = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
  assetCache[path] = dataUrl;
  return dataUrl;
}

const ASSETS = {
  logo: "/certificados/logo-agos.jpg",
  assinaturaThiago: "/certificados/assinatura-thiago.jpg",
  assinaturaDemetrio: "/certificados/assinatura-demetrio.png",
  assinaturaJose: "/certificados/assinatura-jose-rinaldo.png",
};

// Assinantes possíveis, por chave (o modelo guarda a lista em `assinantes`,
// ex.: "thiago" | "thiago,demetrio" | "thiago,jose").
const ASSINANTES: Record<
  string,
  {
    role: string;
    linhas: string[];
    imgUrl: string;
    imgFmt: "JPEG" | "PNG";
    imgAspect: number;
  }
> = {
  thiago: {
    role: "Instrutor Qualificado",
    linhas: [
      "Thiago Batisteli Camini – RG 32967131-5",
      "Engenheiro Civil / Eng. de Segurança do Trabalho / Tecnólogo em Gestão Amb.",
      "CREA nº 5070650830 · Téc. Seg. Trabalho nº 0043324",
    ],
    imgUrl: ASSETS.assinaturaThiago,
    imgFmt: "JPEG",
    imgAspect: 354 / 97,
  },
  demetrio: {
    role: "Responsável Técnico / Instrutor",
    linhas: [
      "Demétrio Vilhena Gozzo",
      "Eng. de Produção Mecânico – CREA 5063501970",
    ],
    imgUrl: ASSETS.assinaturaDemetrio,
    imgFmt: "PNG",
    imgAspect: 341 / 89,
  },
  jose: {
    role: "Eng.º Eletricista e de Seg. do Trabalho",
    linhas: ["José Rinaldo Maniezo", "CREA 1402051913"],
    imgUrl: ASSETS.assinaturaJose,
    imgFmt: "PNG",
    imgAspect: 432 / 101,
  },
};

export async function preloadCertificadoAssets() {
  await Promise.all([
    loadImageAsDataUrl(ASSETS.logo),
    loadImageAsDataUrl(ASSETS.assinaturaThiago),
    loadImageAsDataUrl(ASSETS.assinaturaDemetrio),
    loadImageAsDataUrl(ASSETS.assinaturaJose),
  ]);
}

/** A run of text with a weight — os dados digitados/variáveis saem em negrito. */
type Run = { text: string; bold: boolean };

/** Texto padrão da frente (fallback). O texto real fica editável no banco
 *  (tabela certificados_config), com marcadores interpolados abaixo. */
export const DEFAULT_TEXTO_FRENTE =
  "Certificamos que {nome}, CPF {cpf}, concluiu com aproveitamento satisfatório o curso de capacitação de {curso}, {data}, com carga horária de {carga} horas de treinamento, conforme conteúdo programático no verso em conformidade com {normas}, promovido pelo setor de Segurança do Trabalho da Empresa AGOS Serviços Auxiliares da Construção LTDA, Rua Coral, 234 - Jardim do Mar, São Bernardo do Campo - SP - CEP: 09725-650.";

/** Marcadores aceitos no texto da frente (usado também na tela de configuração). */
export const MARCADORES_FRENTE = [
  "nome",
  "doc",
  "cpf",
  "curso",
  "data",
  "carga",
  "normas",
  "cidade",
] as const;

/** Expande um marcador {chave} nos runs correspondentes; os dados digitados
 *  (nome, cpf, data, cidade) saem em negrito. Retorna null se for desconhecido. */
function expandirMarcador(
  chave: string,
  modelo: CertificadoModelo,
  dados: DadosEmissao
): Run[] | null {
  switch (chave) {
    case "nome":
      return [{ text: dados.nome_funcionario, bold: true }];
    case "cpf":
    case "doc": // número do documento (CPF ou RG), conforme o modelo
      return [{ text: dados.cpf, bold: true }];
    case "cidade":
      return [{ text: dados.cidade, bold: true }];
    case "curso":
      return [{ text: modelo.nome_curso, bold: false }];
    case "carga":
      return [{ text: String(modelo.carga_horaria), bold: false }];
    case "normas":
      return [{ text: modelo.normas_aplicaveis, bold: false }];
    case "data": {
      const temFim =
        dados.data_treinamento_fim &&
        dados.data_treinamento_fim !== dados.data_treinamento;
      if (temFim)
        return [
          { text: "no período de ", bold: false },
          { text: fmtDDMMYYYY(dados.data_treinamento), bold: true },
          { text: " a ", bold: false },
          { text: fmtDDMMYYYY(dados.data_treinamento_fim!), bold: true },
        ];
      return [
        { text: "no dia ", bold: false },
        { text: fmtDDMMYYYY(dados.data_treinamento), bold: true },
      ];
    }
    default:
      return null;
  }
}

/** Monta os runs da frente a partir do template editável, interpolando os
 *  marcadores {chave}. Marcador desconhecido é mantido literal (fica visível). */
function montarParagrafoRuns(
  modelo: CertificadoModelo,
  dados: DadosEmissao,
  template: string
): Run[] {
  const runs: Run[] = [];
  for (const parte of template.split(/(\{[a-zA-Z]+\})/)) {
    if (parte === "") continue;
    const m = parte.match(/^\{([a-zA-Z]+)\}$/);
    if (m) {
      const expandido = expandirMarcador(m[1], modelo, dados);
      if (expandido) {
        runs.push(...expandido);
        continue;
      }
    }
    runs.push({ text: parte, bold: false });
  }
  return runs;
}

/** Renders styled runs with manual word-wrapping, switching Times between
 *  italic and bold-italic per run. Returns the baseline Y of the last line. */
function desenharTextoRico(
  doc: import("jspdf").jsPDF,
  runs: Run[],
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  fontSize: number
): number {
  doc.setFontSize(fontSize);

  // Quebra os runs em palavras, guardando se cada palavra é precedida de espaço.
  const tokens: { text: string; bold: boolean; space: boolean }[] = [];
  let pendingSpace = false;
  for (const run of runs) {
    for (const parte of run.text.split(/(\s+)/)) {
      if (parte === "") continue;
      if (/^\s+$/.test(parte)) {
        pendingSpace = true;
        continue;
      }
      tokens.push({ text: parte, bold: run.bold, space: pendingSpace });
      pendingSpace = false;
    }
  }

  let curX = x;
  let curY = y;
  for (const t of tokens) {
    doc.setFont("times", t.bold ? "bolditalic" : "italic");
    const larguraPalavra = doc.getTextWidth(t.text);
    const larguraEspaco = t.space ? doc.getTextWidth(" ") : 0;
    if (curX > x && curX + larguraEspaco + larguraPalavra > x + maxWidth) {
      // quebra de linha: a palavra vai pro começo da próxima, sem espaço à esquerda
      curX = x;
      curY += lineHeight;
      doc.text(t.text, curX, curY);
      curX += larguraPalavra;
    } else {
      curX += larguraEspaco;
      doc.text(t.text, curX, curY);
      curX += larguraPalavra;
    }
  }
  return curY;
}

/** Draws the classic double-line certificate border frame. */
function desenharMoldura(doc: import("jspdf").jsPDF) {
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  const margem = 10;
  doc.setDrawColor(30, 30, 30);
  doc.setLineWidth(1.1);
  doc.rect(margem, margem, w - margem * 2, h - margem * 2);
  doc.setLineWidth(0.4);
  doc.rect(margem + 2.5, margem + 2.5, w - (margem + 2.5) * 2, h - (margem + 2.5) * 2);
}

async function gerarFrente(
  doc: import("jspdf").jsPDF,
  modelo: CertificadoModelo,
  dados: DadosEmissao,
  textoFrente: string
) {
  const w = doc.internal.pageSize.getWidth();
  desenharMoldura(doc);

  const logo = await loadImageAsDataUrl(ASSETS.logo);
  // logo-agos.jpg is 500x500 (square) — draw square so it isn't squished flat
  doc.addImage(logo, "JPEG", 20, 15, 22, 22);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(60, 60, 60);
  doc.text("SEGURANÇA DO TRABALHO", w - 20, 24, { align: "right" });

  doc.setFont("times", "bolditalic");
  doc.setFontSize(30);
  doc.setTextColor(20, 20, 20);
  doc.text("CERTIFICADO DE CONCLUSÃO", w / 2, 48, { align: "center" });

  doc.setTextColor(30, 30, 30);
  const runs = montarParagrafoRuns(modelo, dados, textoFrente);
  const ultimaLinhaY = desenharTextoRico(doc, runs, 25, 68, w - 50, 6.2, 13);

  const dataAssinaturaBase =
    dados.data_treinamento_fim || dados.data_treinamento;
  const cidadeRuns: Run[] = [
    { text: dados.cidade, bold: true },
    { text: ", ", bold: false },
    { text: fmtDiaMesExtensoAno(dataAssinaturaBase), bold: true },
    { text: ".", bold: false },
  ];
  desenharTextoRico(doc, cidadeRuns, 25, ultimaLinhaY + 12, w - 50, 6, 12);

  // Signature block(s) — colunas espaçadas dentro da moldura. Os instrutores
  // vêm da lista `assinantes` do modelo (1 ou 2 instrutores) + a coluna do
  // Aluno. As linhas de detalhe quebram na largura da coluna.
  const baseY = 150;

  type ColunaAssinatura = {
    img?: string;
    imgFmt?: "JPEG" | "PNG";
    imgAspect?: number; // largura/altura nativa da imagem (mantém a proporção)
    role: string;
    linhas: string[];
  };

  const chavesAssinantes = (modelo.assinantes || "thiago")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => ASSINANTES[s]);
  if (chavesAssinantes.length === 0) chavesAssinantes.push("thiago");

  const colunas: ColunaAssinatura[] = [];
  for (const chave of chavesAssinantes) {
    const a = ASSINANTES[chave];
    colunas.push({
      img: await loadImageAsDataUrl(a.imgUrl),
      imgFmt: a.imgFmt,
      imgAspect: a.imgAspect,
      role: a.role,
      linhas: a.linhas,
    });
  }

  const docTipo = modelo.doc_tipo || "CPF";
  colunas.push({
    role: "Aluno",
    linhas: [dados.nome_funcionario, `${docTipo} ${dados.cpf}`],
  });

  const leftX = 20;
  const rightX = w - 20;
  const gap = 10;
  const colW =
    (rightX - leftX - gap * (colunas.length - 1)) / colunas.length;

  doc.setDrawColor(60, 60, 60);
  doc.setLineWidth(0.3);

  colunas.forEach((col, i) => {
    const x = leftX + i * (colW + gap);
    if (col.img && col.imgFmt && col.imgAspect) {
      // A assinatura ocupa ~72% da largura da coluna (limitada a 66mm), então
      // aproveita o espaço — bem maior no NR35 (coluna larga) — sem distorcer.
      const iw = Math.min(colW * 0.72, 66);
      const ih = iw / col.imgAspect;
      doc.addImage(col.img, col.imgFmt, x + colW / 2 - iw / 2, baseY - ih - 1, iw, ih);
    }
    doc.line(x, baseY, x + colW, baseY);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.text(col.role, x, baseY + 5);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    let y = baseY + 9;
    for (const linha of col.linhas) {
      const wrapped = doc.splitTextToSize(linha, colW) as string[];
      doc.text(wrapped, x, y);
      y += wrapped.length * 3.1;
    }
  });
}

function gerarVerso(doc: import("jspdf").jsPDF, modelo: CertificadoModelo) {
  doc.addPage();
  const w = doc.internal.pageSize.getWidth();
  desenharMoldura(doc);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(20, 20, 20);
  doc.text("CONTEÚDO PROGRAMÁTICO", w / 2, 26, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(30, 30, 30);
  const texto = modelo.conteudo_programatico.replace(/\u000b/g, "\n");
  const linhas = doc.splitTextToSize(texto, w - 44);
  doc.text(linhas, 22, 38, { lineHeightFactor: 1.35 });
}

export async function gerarCertificadoPdf(
  modelo: CertificadoModelo,
  dados: DadosEmissao,
  textoFrente?: string | null
): Promise<import("jspdf").jsPDF> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  // Prioridade do texto da frente: o do próprio modelo → o passado (config
  // global) → o padrão embutido.
  const template =
    modelo.texto_frente?.trim() || textoFrente?.trim() || DEFAULT_TEXTO_FRENTE;
  await gerarFrente(doc, modelo, dados, template);
  gerarVerso(doc, modelo);
  return doc;
}

export function nomeArquivoCertificado(
  modelo: CertificadoModelo,
  dados: DadosEmissao
): string {
  const slug = (s: string) =>
    s
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  return `Certificado ${modelo.norma} - ${slug(modelo.nome_funcao)} - ${slug(
    dados.nome_funcionario
  )}.pdf`;
}
