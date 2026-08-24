import * as XLSX from "xlsx";

/**
 * Uma linha de apontamento extraída da planilha de ponto de uma obra.
 * Layout idêntico ao VT_RIO.xlsx (mesma planilha que os admins de obra
 * recebem já preenchida com os dados do VT, só adicionam o apontamento) —
 * mapeamento de campos confirmado contra a skill `sincronizar-apontamento`,
 * que já fazia essa mesma sincronização manualmente antes do módulo existir:
 *
 *   V. Unitario        -> valorDiario (só atualiza se vier diferente)
 *   Sabados             -> diasReembolso (dias de reembolso VT)
 *     (ou Total M.A quando Sabados vem vazio — obras de tarifa fixa, ex. MUQUI-ES)
 *   QTD Desc VT         -> diasDesconto (dias de desconto VT)
 *   Vr 277              -> vrValor (sempre sobrescreve)
 *   50% / 70% / 100%    -> horas extras
 *   Faltas / Desc.DSR / Ad.Not / Premio -> apontamento
 *
 * O matching de cabeçalho é por substring/normalização, não por posição
 * fixa, já que a planilha que os admins preenchem mensalmente pode variar
 * ligeiramente de layout.
 */
export type LinhaApontamento = {
  matricula: string;
  valorDiario: number | null;
  diasReembolso: number;
  diasDesconto: number;
  vrValor: number | null;
  h50: number;
  h70: number;
  h100: number;
  faltas: number;
  dsr: number;
  adNot: number;
  premio: number;
  /** Valor da Cesta Básica (R$) — coluna "Cesta Básica" da planilha. */
  cestaBasica: number | null;
};

function normalizaHeader(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

type CampoNumerico = Exclude<keyof LinhaApontamento, "matricula">;

const HEADER_MATCHERS: Record<CampoNumerico, (c: string) => boolean> = {
  valorDiario: (c) => c.includes("vunitario"),
  diasReembolso: (c) => c.includes("sabados"),
  diasDesconto: (c) => c.includes("qtddescvt"),
  vrValor: (c) => /^vr\d*$/.test(c),
  h50: (c) => c.includes("50"),
  h70: (c) => c.includes("70"),
  h100: (c) => c.includes("100"),
  faltas: (c) => c.includes("faltas") || c.includes("falta"),
  dsr: (c) => c.includes("descdsr") || c.includes("dsr") || c.includes("descontodsr"),
  adNot: (c) => c.includes("adnot") || c.includes("adicionalnoturno") || c.includes("adnoturno"),
  premio: (c) => c.includes("premio") || c.includes("premios"),
  cestaBasica: (c) => c.includes("cesta"),
};

// "Total M.A" só é usado como fallback de diasReembolso quando Sabados vem
// vazio (obras de tarifa fixa, ex. MUQUI-ES) — não faz parte do matching
// genérico acima porque não é 1:1 com um campo de LinhaApontamento.
const isTotalMA = (c: string) => c.includes("totalma");

const MATRICULA_ALIASES = ["matr", "matricula"];

const MES_NOMES = [
  "janeiro", "fevereiro", "marco", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

function normalizaNomeAba(s: string): string {
  return normalizaHeader(s);
}

/** Escolhe qual aba do arquivo ler. Prioriza a aba cujo nome bate com a
 * competência informada (ex.: "PARA SETEMBRO 2026" para mes=9, ano=2026) —
 * importante porque arquivos como o VT_RIO.xlsx mestre têm uma aba por mês
 * desde 2023, e a primeira aba do arquivo é sempre a mais antiga. Se não
 * achar um nome batendo exatamente, varre de trás pra frente (mais recente
 * primeiro) procurando a primeira aba com um cabeçalho de matrícula válido. */
function escolheAba(
  wb: XLSX.WorkBook,
  competenciaHint?: { ano: number; mes: number }
): { nomeAba: string; sheet: XLSX.WorkSheet } {
  const nomes = wb.SheetNames;

  if (competenciaHint) {
    const alvo = normalizaNomeAba(
      `${MES_NOMES[competenciaHint.mes - 1]}${competenciaHint.ano}`
    );
    const encontrada = nomes.find((n) => normalizaNomeAba(n).includes(alvo));
    if (encontrada) {
      return { nomeAba: encontrada, sheet: wb.Sheets[encontrada] };
    }
  }

  // fallback: varre de trás pra frente (mais recente primeiro) até achar
  // uma aba com cabeçalho de matrícula reconhecível nas primeiras 20 linhas
  for (let i = nomes.length - 1; i >= 0; i--) {
    const sheet = wb.Sheets[nomes[i]];
    const raw: unknown[][] = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      defval: null,
      range: 0,
    });
    const temMatr = raw.slice(0, 20).some((row) => {
      if (!row) return false;
      return row.some(
        (c) => c != null && MATRICULA_ALIASES.includes(normalizaHeader(String(c)))
      );
    });
    if (temMatr) return { nomeAba: nomes[i], sheet };
  }

  // nada encontrado — devolve a primeira aba mesmo, o erro de "matrícula
  // não encontrada" já cobre esse caso de forma clara pro usuário
  return { nomeAba: nomes[0], sheet: wb.Sheets[nomes[0]] };
}

/** Lê a aba mais adequada do arquivo (ver `escolheAba`) e localiza a linha
 * de cabeçalho por conter uma coluna de matrícula reconhecível (não assume
 * posição fixa, já que cada obra pode ter linhas de título antes do
 * cabeçalho). */
export async function parseApontamentoXlsx(
  file: File,
  competenciaHint?: { ano: number; mes: number }
): Promise<{
  linhas: LinhaApontamento[];
  avisos: string[];
  colunasEncontradas: Partial<Record<CampoNumerico, boolean>>;
  abaLida: string;
}> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const { nomeAba, sheet } = escolheAba(wb, competenciaHint);
  const raw: unknown[][] = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: null,
  });

  const avisos: string[] = [];

  let headerRowIdx = -1;
  let colMap: Partial<Record<CampoNumerico, number>> = {};
  let matrIdxFinal = -1;
  let totalMAIdx: number | null = null;

  for (let i = 0; i < Math.min(raw.length, 20); i++) {
    const row = raw[i];
    if (!row) continue;
    const normalized = row.map((c) => (c == null ? "" : normalizaHeader(String(c))));
    const matrIdx = normalized.findIndex((c) => MATRICULA_ALIASES.includes(c));
    if (matrIdx === -1) continue;

    const map: Partial<Record<CampoNumerico, number>> = {};
    (Object.keys(HEADER_MATCHERS) as CampoNumerico[]).forEach((key) => {
      const idx = normalized.findIndex((c) => HEADER_MATCHERS[key](c));
      if (idx !== -1) map[key] = idx;
    });

    const totalMA = normalized.findIndex((c) => isTotalMA(c));

    headerRowIdx = i;
    colMap = map;
    matrIdxFinal = matrIdx;
    totalMAIdx = totalMA !== -1 ? totalMA : null;
    break;
  }

  if (headerRowIdx === -1) {
    return {
      linhas: [],
      avisos: [
        `Não encontrei uma coluna de matrícula (Matr/Matrícula) nas primeiras 20 linhas da aba "${nomeAba}".`,
      ],
      colunasEncontradas: {},
      abaLida: nomeAba,
    };
  }

  const faltando = (Object.keys(HEADER_MATCHERS) as CampoNumerico[]).filter(
    (k) => colMap[k] === undefined
  );
  if (faltando.length > 0) {
    avisos.push(
      `Colunas não encontradas (tratadas como zero/em branco): ${faltando.join(", ")}.`
    );
  }

  const num = (v: unknown): number => {
    if (v == null || v === "") return 0;
    const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
    return Number.isFinite(n) ? n : 0;
  };

  const numOuNull = (v: unknown): number | null => {
    if (v == null || v === "") return null;
    const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
    return Number.isFinite(n) ? n : null;
  };

  const linhas: LinhaApontamento[] = [];
  for (let i = headerRowIdx + 1; i < raw.length; i++) {
    const row = raw[i];
    if (!row) continue;
    const matrRaw = row[matrIdxFinal];
    if (matrRaw == null || String(matrRaw).trim() === "") continue;
    if (!/^\d+$/.test(String(matrRaw).trim())) continue; // descarta linhas de rodapé/total

    // dias de reembolso: usa Sabados; se vier vazio, cai para Total M.A
    // (obras de tarifa fixa, ex. MUQUI-ES, onde Sabados fica sempre em branco)
    const sabadosVal =
      colMap.diasReembolso != null ? row[colMap.diasReembolso] : null;
    const totalMAVal = totalMAIdx != null ? row[totalMAIdx] : null;
    const diasReembolso =
      sabadosVal != null && sabadosVal !== "" ? num(sabadosVal) : num(totalMAVal);

    linhas.push({
      matricula: String(matrRaw).trim(),
      valorDiario: colMap.valorDiario != null ? numOuNull(row[colMap.valorDiario]) : null,
      diasReembolso,
      diasDesconto: colMap.diasDesconto != null ? num(row[colMap.diasDesconto]) : 0,
      vrValor: colMap.vrValor != null ? numOuNull(row[colMap.vrValor]) : null,
      h50: colMap.h50 != null ? num(row[colMap.h50]) : 0,
      h70: colMap.h70 != null ? num(row[colMap.h70]) : 0,
      h100: colMap.h100 != null ? num(row[colMap.h100]) : 0,
      faltas: colMap.faltas != null ? num(row[colMap.faltas]) : 0,
      dsr: colMap.dsr != null ? num(row[colMap.dsr]) : 0,
      adNot: colMap.adNot != null ? num(row[colMap.adNot]) : 0,
      premio: colMap.premio != null ? num(row[colMap.premio]) : 0,
      cestaBasica: colMap.cestaBasica != null ? numOuNull(row[colMap.cestaBasica]) : null,
    });
  }

  return {
    linhas,
    avisos,
    colunasEncontradas: {
      valorDiario: colMap.valorDiario !== undefined,
      diasReembolso: colMap.diasReembolso !== undefined || totalMAIdx !== null,
      diasDesconto: colMap.diasDesconto !== undefined,
      vrValor: colMap.vrValor !== undefined,
    },
    abaLida: nomeAba,
  };
}
