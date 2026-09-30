import type { EpiCatalogoItem, EpiItem } from "./types";
import { resolverCatalogo } from "./types";

const LOGO = "/certificados/logo-agos.jpg";

const TERMO =
  "Pelo presente, declaro ter recebido da AGOS SERVIÇOS AUXILIARES DA " +
  "CONSTRUÇÃO LTDA o(s) Equipamento(s) de Proteção Individual – E.P.I.(s), " +
  "abaixo relacionado(s), de acordo com a necessidade de meu cargo/função, em " +
  "perfeito estado de conservação e funcionamento, devendo solicitar sua " +
  "substituição sempre que o(s) mesmo(s) estiver(em) desgastado(s), danificado(s) " +
  "ou não mais preencher(em) as finalidades a que se destina(m), ficando ciente " +
  "da obrigatoriedade de seu uso, bem como da devolução do(s) mesmo(s) ao término " +
  "do Contrato de Trabalho, responsabilizando-me ainda, enquanto colaborador, " +
  "pela sua guarda e conservação, cabendo indenizar seu custo à Empresa no caso " +
  "de extravio ou danos provocados por utilização indevida, conforme preceitua a " +
  "NR-6, item 6.2, 6.7 e suas alíneas, atendendo ainda o disposto na NR-1, item " +
  "1.7, alíneas A e C, 1.8, alíneas A, B e D, subitem 1.8.1, da Portaria " +
  "Ministerial nº 3214 de 08.06.78, fundamentada pela CLT, lei nº 6514, Cap. “V”, " +
  "artigos 157 e 158.";

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

function fmtDDMMYYYY(value: string): string {
  const [y, m, d] = value.split("-").map(Number);
  return `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y}`;
}

export type DadosFichaEpi = {
  nome: string;
  funcao: string;
  dataEntrega: string; // "YYYY-MM-DD"
  itens: EpiItem[];
};

export async function gerarFichaEpiPdf(
  dados: DadosFichaEpi,
  catalogo: EpiCatalogoItem[]
): Promise<import("jspdf").jsPDF> {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;
  const doc = new jsPDF({ unit: "mm", format: "a4" });

  const logo = await loadImageAsDataUrl(LOGO).catch(() => null);
  if (logo) doc.addImage(logo, "JPEG", 14, 9, 20, 20);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("CONTROLE DE ENTREGA DE EPI", 110, 16, { align: "center" });
  doc.setFontSize(10);
  doc.text("FICHA INDIVIDUAL DE FUNCIONÁRIO", 110, 22, { align: "center" });

  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text(`NOME: ${dados.nome}`, 14, 38);
  doc.text(`FUNÇÃO: ${dados.funcao}`, 196, 38, { align: "right" });

  const dataFmt = fmtDDMMYYYY(dados.dataEntrega);
  const body = dados.itens.map((it) => {
    const cat = resolverCatalogo(it.descricao, catalogo);
    return [dataFmt, String(it.qtd), it.descricao, cat?.ca ?? "", "", ""];
  });

  autoTable(doc, {
    startY: 43,
    margin: { left: 14, right: 14 },
    head: [
      [
        "DATA DE\nENTREGA",
        "QTDE",
        "DESCRIÇÃO DO EPI",
        "C.A",
        "ASSINATURA DO FUNCIONÁRIO",
        "OBSERVAÇÕES",
      ],
    ],
    body,
    styles: { fontSize: 8, cellPadding: 1.4, lineColor: [180, 180, 180], lineWidth: 0.1 },
    headStyles: {
      fillColor: [44, 44, 44],
      textColor: 255,
      fontSize: 7.5,
      halign: "center",
      valign: "middle",
    },
    columnStyles: {
      0: { halign: "center", cellWidth: 20 },
      1: { halign: "center", cellWidth: 12 },
      3: { halign: "center", cellWidth: 16 },
      4: { cellWidth: 42 },
      5: { cellWidth: 24 },
    },
  });

  const lastY =
    (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable
      .finalY + 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  const linhas = doc.splitTextToSize(TERMO, 182);
  doc.text(linhas, 14, lastY, { align: "justify", maxWidth: 182 });

  let y = lastY + linhas.length * 3.1 + 12;
  if (y > 280) y = 280;
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("CIENTE:", 14, y);
  doc.line(70, y + 6, 150, y + 6);
  doc.setFont("helvetica", "normal");
  doc.text(dados.nome, 110, y + 11, { align: "center" });

  return doc;
}

export function nomeArquivoFichaEpi(dados: DadosFichaEpi): string {
  const limpo = (s: string) => s.replace(/[^\w\sÀ-ÿ.-]/g, "").trim();
  return `Ficha EPI - ${limpo(dados.nome)} - ${limpo(dados.funcao)}.pdf`;
}
