// Parser de holerites (Bitti) — 100% regex sobre o texto extraído do PDF.
// Layout fixo, sempre do mesmo sistema de folha. O PDF de uma obra tem 1 ou 2
// páginas por funcionário: a 2ª página (rodapé com VALOR LÍQUIDO / conta) NÃO
// tem CPF e é anexada ao último funcionário processado.
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

const RE_CPF = /(\d{3}\.\d{3}\.\d{3}-\d{2})/;
// matrícula (4-6 díg) + NOME + código da obra (6 díg). O nome longo pode colar
// no código, por isso \s* (nunca espaço obrigatório) antes do último grupo.
const RE_NOME = /\b(\d{4,6})\s+([A-ZÀ-Ü][A-ZÀ-Ü'.\- ]{4,45}?)\s*(\d{6})\b/;
const RE_COMP = /COMP\.?\s*(\d{2})\/(\d{4})/;
const RE_OBRA = /\b(\d{2}-[A-Z0-9À-Ü]+-\d+)\b/;
const RE_LIQ = /L[IÍ]QUIDO[^\d]{0,40}?([\d.]+,\d{2})/;
const RE_ADI = /ADIANTAMENTO\s+QUINZEN[^\d]{0,60}?([\d.]+,\d{2})/;
const RE_DEV = /Devolu[çc][ãa]o\s+Provis[ãa]o[^\d]{0,60}?([\d.]+,\d{2})/i;

function parseMoeda(s: string): number {
  return parseFloat(s.replace(/\./g, "").replace(",", "."));
}

export type FuncionarioParse = {
  matricula: string; // como veio no holerite (ex.: "008897")
  nome: string;
  cpf: string;
  paginas: number[]; // índices 0-based das páginas do bloco
  liquido: number | null;
  adiantamento: number | null;
  devolucao: number | null;
};

export type Pendencia = {
  pagina: number; // 1-based (para exibir ao ADM)
  motivo: string;
  cpf?: string;
};

export type ResultadoParse = {
  totalPaginas: number;
  competencia: string | null; // "AAAA-MM-01"
  obra: string | null; // ex.: "01-ANGRA-120"
  funcionarios: FuncionarioParse[];
  pendentes: Pendencia[];
};

/** Extrai o texto de cada página juntando os tokens com espaço e colapsando
 *  espaços — o holerite imprime 2 vias e os tokens vêm quebrados; a forma
 *  "achatada" é a que as regexes de referência (com espaço) casam. */
async function textoPorPagina(data: Uint8Array): Promise<string[]> {
  const doc = await getDocument({ data, useSystemFonts: true }).promise;
  const paginas: string[] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const tc = await page.getTextContent();
    const txt = tc.items
      .map((i) => ("str" in i ? i.str : ""))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    paginas.push(txt);
  }
  return paginas;
}

function preencherValores(f: FuncionarioParse, txt: string) {
  if (f.liquido === null) {
    const m = RE_LIQ.exec(txt);
    if (m) f.liquido = parseMoeda(m[1]);
  }
  if (f.adiantamento === null) {
    const m = RE_ADI.exec(txt);
    if (m) f.adiantamento = parseMoeda(m[1]);
  }
  if (f.devolucao === null) {
    const m = RE_DEV.exec(txt);
    if (m) f.devolucao = parseMoeda(m[1]);
  }
}

export async function parseHoleritesPdf(
  data: Uint8Array
): Promise<ResultadoParse> {
  const paginas = await textoPorPagina(data);

  let competencia: string | null = null;
  let obra: string | null = null;
  const funcionarios: FuncionarioParse[] = [];
  const pendentes: Pendencia[] = [];
  let ultimo: FuncionarioParse | null = null;

  paginas.forEach((txt, i) => {
    if (competencia === null) {
      const c = RE_COMP.exec(txt);
      if (c) competencia = `${c[2]}-${c[1]}-01`;
    }
    if (obra === null) {
      const o = RE_OBRA.exec(txt);
      if (o) obra = o[1];
    }

    const cpfM = RE_CPF.exec(txt);

    if (!cpfM) {
      // Página de continuação: anexa ao último funcionário.
      if (ultimo) {
        ultimo.paginas.push(i);
        preencherValores(ultimo, txt);
      } else {
        pendentes.push({
          pagina: i + 1,
          motivo: "Página sem CPF e sem funcionário anterior (órfã)",
        });
      }
      return;
    }

    const nomeM = RE_NOME.exec(txt);
    if (!nomeM) {
      pendentes.push({
        pagina: i + 1,
        motivo: "CPF encontrado, mas matrícula/nome não legível",
        cpf: cpfM[1],
      });
      ultimo = null; // não anexa continuação a bloco quebrado
      return;
    }

    const f: FuncionarioParse = {
      matricula: nomeM[1],
      nome: nomeM[2].trim().replace(/\s+/g, " "),
      cpf: cpfM[1],
      paginas: [i],
      liquido: null,
      adiantamento: null,
      devolucao: null,
    };
    preencherValores(f, txt);
    funcionarios.push(f);
    ultimo = f;
  });

  return {
    totalPaginas: paginas.length,
    competencia,
    obra,
    funcionarios,
    pendentes,
  };
}
