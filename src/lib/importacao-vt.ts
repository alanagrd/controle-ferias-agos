import * as XLSX from "xlsx";

/**
 * Uma linha de apontamento extraída da planilha de ponto de uma obra.
 * Colunas mapeadas contra o layout real de VT_RIO.xlsx (mesmas usadas na
 * carga inicial de Setembro/2026 via SQL): Matr | 50% | 70% | 100% | Faltas |
 * Desc.DSR | Ad.Not | Premio. A planilha de ponto que os admins de obra
 * preenchem mensalmente pode ter nomes de coluna levemente diferentes —
 * por isso o matching de cabeçalho abaixo é por substring/normalização, não
 * por posição fixa.
 */
export type LinhaApontamento = {
  matricula: string;
  h50: number;
  h70: number;
  h100: number;
  faltas: number;
  dsr: number;
  adNot: number;
  premio: number;
};

function normalizaHeader(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

const HEADER_ALIASES: Record<keyof Omit<LinhaApontamento, "matricula">, string[]> = {
  h50: ["50", "he50", "hextra50"],
  h70: ["70", "he70", "hextra70"],
  h100: ["100", "he100", "hextra100"],
  faltas: ["faltas", "falta"],
  dsr: ["descdsr", "dsr", "descontodsr"],
  adNot: ["adnot", "adicionalnoturno", "adnoturno"],
  premio: ["premio", "premios"],
};

const MATRICULA_ALIASES = ["matr", "matricula"];

/** Lê a primeira planilha do arquivo e localiza a linha de cabeçalho por
 * conter uma coluna de matrícula reconhecível (não assume posição fixa,
 * já que cada obra pode ter linhas de título antes do cabeçalho). */
export async function parseApontamentoXlsx(
  file: File
): Promise<{ linhas: LinhaApontamento[]; avisos: string[] }> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const raw: unknown[][] = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: null,
  });

  const avisos: string[] = [];

  let headerRowIdx = -1;
  let colMap: Partial<Record<keyof LinhaApontamento, number>> = {};

  for (let i = 0; i < Math.min(raw.length, 20); i++) {
    const row = raw[i];
    if (!row) continue;
    const normalized = row.map((c) => (c == null ? "" : normalizaHeader(String(c))));
    const matrIdx = normalized.findIndex((c) => MATRICULA_ALIASES.includes(c));
    if (matrIdx === -1) continue;

    const map: Partial<Record<keyof LinhaApontamento, number>> = {
      matricula: matrIdx,
    };
    (Object.keys(HEADER_ALIASES) as (keyof typeof HEADER_ALIASES)[]).forEach(
      (key) => {
        const idx = normalized.findIndex((c) =>
          HEADER_ALIASES[key].some((alias) => c.includes(alias))
        );
        if (idx !== -1) map[key] = idx;
      }
    );

    headerRowIdx = i;
    colMap = map;
    break;
  }

  if (headerRowIdx === -1) {
    return {
      linhas: [],
      avisos: [
        "Não encontrei uma coluna de matrícula (Matr/Matrícula) nas primeiras 20 linhas do arquivo.",
      ],
    };
  }

  const faltando = (
    Object.keys(HEADER_ALIASES) as (keyof typeof HEADER_ALIASES)[]
  ).filter((k) => colMap[k] === undefined);
  if (faltando.length > 0) {
    avisos.push(
      `Colunas não encontradas (tratadas como zero): ${faltando.join(", ")}.`
    );
  }

  const num = (v: unknown): number => {
    if (v == null || v === "") return 0;
    const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
    return Number.isFinite(n) ? n : 0;
  };

  const linhas: LinhaApontamento[] = [];
  for (let i = headerRowIdx + 1; i < raw.length; i++) {
    const row = raw[i];
    if (!row) continue;
    const matrRaw = colMap.matricula != null ? row[colMap.matricula] : null;
    if (matrRaw == null || String(matrRaw).trim() === "") continue;
    if (!/^\d+$/.test(String(matrRaw).trim())) continue; // descarta linhas de rodapé/total

    linhas.push({
      matricula: String(matrRaw).trim(),
      h50: colMap.h50 != null ? num(row[colMap.h50]) : 0,
      h70: colMap.h70 != null ? num(row[colMap.h70]) : 0,
      h100: colMap.h100 != null ? num(row[colMap.h100]) : 0,
      faltas: colMap.faltas != null ? num(row[colMap.faltas]) : 0,
      dsr: colMap.dsr != null ? num(row[colMap.dsr]) : 0,
      adNot: colMap.adNot != null ? num(row[colMap.adNot]) : 0,
      premio: colMap.premio != null ? num(row[colMap.premio]) : 0,
    });
  }

  return { linhas, avisos };
}
