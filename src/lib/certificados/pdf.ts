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
};

export async function preloadCertificadoAssets() {
  await Promise.all([
    loadImageAsDataUrl(ASSETS.logo),
    loadImageAsDataUrl(ASSETS.assinaturaThiago),
    loadImageAsDataUrl(ASSETS.assinaturaDemetrio),
  ]);
}

/** A run of text with a weight — os dados digitados/variáveis saem em negrito. */
type Run = { text: string; bold: boolean };

function montarParagrafoRuns(
  modelo: CertificadoModelo,
  dados: DadosEmissao
): Run[] {
  const temFim =
    dados.data_treinamento_fim &&
    dados.data_treinamento_fim !== dados.data_treinamento;

  const runs: Run[] = [
    { text: "Certificamos que ", bold: false },
    { text: dados.nome_funcionario, bold: true },
    { text: ", CPF ", bold: false },
    { text: dados.cpf, bold: true },
    {
      text: `, concluiu com aproveitamento satisfatório o curso de capacitação de ${modelo.nome_curso}, `,
      bold: false,
    },
  ];

  if (temFim) {
    runs.push({ text: "no período de ", bold: false });
    runs.push({ text: fmtDDMMYYYY(dados.data_treinamento), bold: true });
    runs.push({ text: " a ", bold: false });
    runs.push({ text: fmtDDMMYYYY(dados.data_treinamento_fim!), bold: true });
  } else {
    runs.push({ text: "no dia ", bold: false });
    runs.push({ text: fmtDDMMYYYY(dados.data_treinamento), bold: true });
  }

  runs.push({
    text: `, com carga horária de ${modelo.carga_horaria} horas de treinamento, conforme conteúdo programático no verso em conformidade com ${modelo.normas_aplicaveis}, promovido pelo setor de Segurança do Trabalho da Empresa AGOS Serviços Auxiliares da Construção LTDA, Rua Coral, 234 - Jardim do Mar, São Bernardo do Campo - SP - CEP: 09725-650.`,
    bold: false,
  });

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
  dados: DadosEmissao
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
  const runs = montarParagrafoRuns(modelo, dados);
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

  // Signature block(s) — evenly spaced columns that always stay inside the
  // frame. NR12 = dois instrutores + aluno (3 colunas); NR35 = um instrutor +
  // aluno (2 colunas). As linhas de detalhe quebram na largura da coluna, então
  // títulos longos nunca invadem a coluna vizinha nem passam da borda.
  const temSegundoInstrutor = modelo.norma === "NR12";
  const baseY = 150;

  type ColunaAssinatura = {
    img?: string;
    imgFmt?: "JPEG" | "PNG";
    imgW?: number;
    imgH?: number;
    role: string;
    linhas: string[];
  };

  const thiago = await loadImageAsDataUrl(ASSETS.assinaturaThiago);
  const colunas: ColunaAssinatura[] = [
    {
      img: thiago,
      imgFmt: "JPEG",
      imgW: 40,
      imgH: 11, // 354x97 → mantém a proporção
      role: "Instrutor Qualificado",
      linhas: [
        "Thiago Batisteli Camini – RG 32967131-5",
        "Engenheiro Civil / Eng. de Segurança do Trabalho / Tecnólogo em Gestão Amb.",
        "CREA nº 5070650830 · Téc. Seg. Trabalho nº 0043324",
      ],
    },
  ];

  if (temSegundoInstrutor) {
    const demetrio = await loadImageAsDataUrl(ASSETS.assinaturaDemetrio);
    colunas.push({
      img: demetrio,
      imgFmt: "PNG",
      imgW: 40,
      imgH: 10.4, // 341x89 → mantém a proporção
      role: "Responsável Técnico / Instrutor",
      linhas: [
        "Demétrio Vilhena Gozzo",
        "Eng. de Produção Mecânico – CREA 5063501970",
      ],
    });
  }

  colunas.push({
    role: "Aluno",
    linhas: [dados.nome_funcionario, `CPF ${dados.cpf}`],
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
    if (col.img && col.imgFmt) {
      const iw = col.imgW ?? 34;
      const ih = col.imgH ?? 12;
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
  dados: DadosEmissao
): Promise<import("jspdf").jsPDF> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  await gerarFrente(doc, modelo, dados);
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
