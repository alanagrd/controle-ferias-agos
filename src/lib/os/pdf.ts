import type { DadosOs, OsModelo } from "./types";

const LOGO = "/certificados/logo-agos.jpg";

const EMPRESA = "AGOS SERV AUX DA CONSTRUCAO LTDA";
const CNPJ = "04.113.492/0001-82";
export const SETOR_PADRAO = "CANTEIRO DE OBRAS";
const LOCAL = "SÃO BERNARDO DO CAMPO";

const ASSINANTE = {
  nome: "Thiago Batisteli Camini",
  cargo: "Eng. Seg. do Trabalho",
  crea: "CREA 5070650830",
};

const INTRO =
  "Pela presente Ordem de Serviço objetivamos informar os trabalhadores que " +
  "executam suas atividades sobre as condições de segurança e saúde, bem como " +
  "aos riscos aos quais estão expostos, como medida preventiva e tendo como " +
  "parâmetro os agentes físicos, químicos, biológicos, mecânico, ergonômico e " +
  "biomecânico citados na NR-01 (Disposições Gerais e Gerenciamento de Riscos " +
  "Ocupacionais) e NR-09 (Avaliação e Controle das Exposições Ocupacionais a " +
  "Agentes Físicos, Químicos e Biológicos), bem como os procedimentos de " +
  "aplicação da NR-06 (Equipamento de Proteção Individual – EPI) e NR-17 " +
  "(Ergonomia), de forma a padronizar comportamentos para prevenir acidentes " +
  "e/ou doenças ocupacionais.";

const ORIENTACOES: string[] = [
  "Não transite pela Obra sem capacete, óculos, protetor auricular, calçado de segurança e uniforme;",
  "Não será permitido o uso de tênis, chinelos nos locais de trabalho;",
  "Não correr dentro das instalações da Obra / Projeto;",
  "Quando motorizado não exceder o limite máximo de velocidade permitida de 10 km/h;",
  "Não ofender o próximo com palavras ofensivas e/ou de insultos;",
  "Use os EPI’s apenas com a finalidade a que se destina a atividade e mantenha-os sob sua guarda e conservação;",
  "Avisar ao Encarregado, CIPA ou Segurança do Trabalho a perda ou extravio do EPI ou ainda quando o EPI for danificado de forma acidental, para investigação e efetuar a reposição;",
  "Nos trabalhos em altura superior a 1,80m ou na periferia da obra, use o cinto de segurança preso em locais adequados, tais como linha de vida ou trava-quedas;",
  "Antes de trabalhar em ambiente com pouca iluminação, solicite ao eletricista a instalação de extensão para iluminação;",
  "Mantenha as latas de tinta, solventes, vernizes, etc., corretamente fechadas e em depósito de produto químico separado e armazenado adequadamente, com restrição de acesso e protegido por extintores;",
  "Somente pessoas habilitadas poderão operar máquinas, ferramentas ou equipamentos;",
  "Não transporte ferramentas ou equipamentos pontiagudos nos bolsos do uniforme;",
  "Não improvise extensões elétricas e plugues. Não conserte equipamentos elétricos defeituosos. Comunique ao eletricista;",
  "Confira o estado de conservação das ferramentas manuais e/ou rotativas ao recebê-las;",
  "Verifique com atenção a fixação dos cabos das ferramentas;",
  "Não desça materiais (ferragens, madeiras, etc.) em queda livre. Use cordas e amarre-os adequadamente;",
  "Tenha atenção e cuidado com as partes móveis de máquinas, não mantendo contato direto com o equipamento em movimento;",
  "Adote posicionamento correto ao manusear ou transportar materiais;",
  "Se o peso for excessivo solicite ajuda de um ou mais colaboradores e/ou equipamento;",
  "Preserve o Meio Ambiente, mantendo a Obra / Projeto limpo e organizado. Descarte restos de alimentos e materiais em lixeiras adequadas;",
  "Informe imediatamente ao Encarregado ou Técnico de Segurança do Trabalho as não conformidades de saúde e segurança encontradas, caso não possa corrigi-las;",
  "Submeter-se aos exames médicos previstos, quando solicitado pela medicina do trabalho;",
  "Não deixar qualquer tipo de material em cima das estruturas, andaimes ou borda de valas;",
  "Não transitar ou permanecer embaixo de cargas suspensas;",
  "Havendo qualquer tipo de risco de acidente, comunicar imediatamente ao superior imediato, à Segurança do Trabalho ou à CIPA;",
  "Não descer ou subir em veículos em movimento;",
  "Em caso de dúvidas na execução de uma atividade, consulte o Líder.",
];

const DIREITO_RECUSA =
  "DIREITO DE RECUSA: É o direito, previsto na Legislação (Art. 13 da Convenção " +
  "155 da OIT), que o trabalhador pode exercer quando, ao iniciar ou no " +
  "desenvolvimento de uma atividade, perceber qualquer situação de RGI – Risco " +
  "Grave e Iminente, que coloque em risco a sua integridade física ou a sua " +
  "saúde e também a de seus colegas de trabalho.";

const TERMO =
  "Recebi treinamento de segurança e saúde no trabalho, bem como todos os " +
  "equipamentos de proteção individual para neutralizar a ação dos agentes " +
  "nocivos presentes no meu ambiente de trabalho. Serei cobrado, conforme amparo " +
  "legal, com relação ao uso destes equipamentos e estou ciente de que a não " +
  "utilização é passível de sanções legais.";

const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

const assetCache: Record<string, string> = {};
async function loadImageAsDataUrl(path: string): Promise<string | null> {
  if (assetCache[path]) return assetCache[path];
  try {
    const res = await fetch(path);
    const blob = await res.blob();
    const dataUrl: string = await new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
    assetCache[path] = dataUrl;
    return dataUrl;
  } catch {
    return null;
  }
}

function fmtBR(value: string): string {
  if (!value) return "____/____/______";
  const [y, m, d] = value.split("-");
  return `${d}/${m}/${y}`;
}
function fmtExtenso(value: string): string {
  const [y, m, d] = value.split("-").map(Number);
  return `${LOCAL}, ${String(d).padStart(2, "0")} de ${MESES[m - 1]} de ${y}.`;
}

export async function gerarOrdemServicoPdf(
  modelo: OsModelo,
  dados: DadosOs
): Promise<import("jspdf").jsPDF> {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;
  const doc = new jsPDF({ unit: "mm", format: "a4" });

  const ML = 14;
  const MR = 196;
  const MAXW = MR - ML;
  const BOTTOM = 284;

  let y = 12;

  const logo = await loadImageAsDataUrl(LOGO);
  if (logo) doc.addImage(logo, "JPEG", ML, 8, 18, 18);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("ORDEM DE SERVIÇO", 110, 16, { align: "center" });
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text("NR-01 · NR-06 · NR-09 · NR-17", 110, 21, { align: "center" });
  y = 30;

  // Cabeçalho (dados)
  autoTable(doc, {
    startY: y,
    margin: { left: ML, right: 14 },
    theme: "grid",
    styles: { fontSize: 8, cellPadding: 1.4 },
    body: [
      [
        { content: `Empresa: ${EMPRESA}`, colSpan: 2 },
        { content: `CNPJ: ${CNPJ}` },
      ],
      [
        { content: `Setor: ${dados.setor}` },
        { content: `Função: ${dados.funcao}` },
        { content: `Admissão: ${fmtBR(dados.admissao)}` },
      ],
      [
        { content: `Nome: ${dados.nome}` },
        { content: `Cód: ${dados.codigo || "—"}` },
        { content: `CBO: ${dados.cbo || "—"}  ·  Emissão: ${fmtBR(dados.dataEmissao)}` },
      ],
    ],
  });
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 4;

  const novaPagina = (need: number) => {
    if (y + need > BOTTOM) {
      doc.addPage();
      y = 16;
    }
  };

  const paragrafo = (
    texto: string,
    opts: { size?: number; bold?: boolean; indent?: number; bullet?: boolean } = {}
  ) => {
    const { size = 9, bold = false, indent = 0, bullet = false } = opts;
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);
    const gap = size * 0.42 + 0.6;
    const prefix = bullet ? "•  " : "";
    const lines = doc.splitTextToSize(prefix + texto, MAXW - indent) as string[];
    for (const ln of lines) {
      novaPagina(gap);
      doc.text(ln, ML + indent, y);
      y += gap;
    }
  };

  const titulo = (texto: string) => {
    y += 2.5;
    novaPagina(8);
    doc.setFillColor(238, 238, 238);
    doc.rect(ML, y - 3.4, MAXW, 5.6, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.text(texto, ML + 1.5, y);
    y += 4.5;
  };

  paragrafo(INTRO, { size: 8.5 });

  titulo("Atividades");
  paragrafo(modelo.atividades || "—");

  // Riscos
  if (modelo.riscos.length > 0) {
    y += 2;
    novaPagina(20);
    autoTable(doc, {
      startY: y,
      margin: { left: ML, right: 14 },
      theme: "grid",
      styles: { fontSize: 8, cellPadding: 1.4, valign: "middle" },
      headStyles: { fillColor: [44, 44, 44], textColor: 255, fontSize: 8 },
      head: [["Grupo de Risco", "Fatores de Risco"]],
      body: modelo.riscos.map((r) => [r.grupo, r.fatores.join("\n")]),
      columnStyles: { 0: { cellWidth: 55, fontStyle: "bold" } },
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 2;
  }

  titulo("Equipamentos de Proteção Individual (EPI) Necessários e/ou Utilizados");
  paragrafo(modelo.epis || "—");

  if (modelo.medidas.length > 0) {
    titulo("Medidas Preventivas para os Riscos Ambientais");
    for (const m of modelo.medidas) paragrafo(m, { bullet: true, indent: 2 });
  }

  titulo("Orientações de Segurança do Trabalho");
  for (const o of ORIENTACOES) paragrafo(o, { bullet: true, indent: 2, size: 8.5 });

  y += 2;
  paragrafo(DIREITO_RECUSA, { size: 8.5 });
  y += 1;
  paragrafo(TERMO, { size: 8.5 });

  // Local e data + assinaturas
  novaPagina(38);
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(fmtExtenso(dados.dataEmissao), ML, y);
  y += 16;

  // Assinatura do funcionário (esquerda) e do engenheiro (direita)
  doc.line(ML, y, ML + 80, y);
  doc.line(116, y, 196, y);
  y += 4.5;
  doc.setFontSize(9);
  doc.text(dados.nome, ML + 40, y, { align: "center" });
  doc.setFont("helvetica", "bold");
  doc.text(ASSINANTE.nome, 156, y, { align: "center" });
  y += 4;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(
    dados.cpf ? `CPF ${dados.cpf}` : "Assinatura do Funcionário",
    ML + 40,
    y,
    { align: "center" }
  );
  doc.text(`${ASSINANTE.cargo} · ${ASSINANTE.crea}`, 156, y, {
    align: "center",
  });

  return doc;
}

export function nomeArquivoOs(dados: DadosOs): string {
  const limpo = (s: string) => s.replace(/[^\w\sÀ-ÿ.-]/g, "").trim();
  return `Ordem de Servico - ${limpo(dados.nome)} - ${limpo(dados.funcao)}.pdf`;
}
