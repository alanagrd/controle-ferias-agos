import clientesMap from "./clientes-map.json";

const COMBINING_MARKS = new RegExp("[\\u0300-\\u036f]", "g");

export function normName(s: string, truncate30 = false): string {
  if (!s) return "";
  let out = s
    .trim()
    .normalize("NFKD")
    .replace(COMBINING_MARKS, "") // remove accents (after NFKD decomposition)
    .replace(/\./g, " ")
    .replace(/\s+/g, " ")
    .toUpperCase()
    .trim();
  if (truncate30) out = out.slice(0, 30).trim();
  return out;
}

export function toDateISO(v: string | undefined): string | null {
  if (!v) return null;
  const s = v.trim();
  if (!s || s.startsWith("00/00")) return null;
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const [, dd, mm, yyyy] = m;
  if (Number(yyyy) <= 1900) return null;
  return `${yyyy}-${mm}-${dd}`;
}

export function splitEmpresaObra(
  razaoSocial: string
): { empresa: string; obra: string | null } {
  if (razaoSocial.includes(" - ")) {
    const [antes, ...resto] = razaoSocial.split(" - ");
    const obra = resto.join(" - ").trim();
    const empresa = antes.trim().split(" ")[0].toUpperCase();
    return { empresa, obra: obra || null };
  }
  return { empresa: razaoSocial.trim().split(" ")[0].toUpperCase(), obra: null };
}

/**
 * Classic Levenshtein edit distance (single-row DP, O(min(m,n)) memory).
 */
export function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const prev = new Array(n + 1);
  const curr = new Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= n; j++) prev[j] = curr[j];
  }
  return prev[n];
}

/**
 * Threshold picked to catch accent/typo/abbreviation-level differences
 * ("JOSÉ DA SILVA" vs "JOSE SILVA") without pairing genuinely different
 * names — anything scoring below this is treated as unrelated.
 */
export const DIVERGENCIA_SIMILARITY_THRESHOLD = 0.82;

/**
 * Similarity between two (unnormalized) names, in [0, 1]. Uses normName to
 * strip accents/punctuation/casing, then a length-normalized Levenshtein
 * distance. Names whose normalized lengths differ too much are treated as
 * unrelated (score 0) — a same-person typo rarely changes name length by
 * more than half.
 */
export function nameSimilarity(a: string, b: string): number {
  const na = normName(a);
  const nb = normName(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  const maxLen = Math.max(na.length, nb.length);
  const minLen = Math.min(na.length, nb.length);
  if (minLen / maxLen < 0.5) return 0;
  const dist = levenshteinDistance(na, nb);
  return 1 - dist / maxLen;
}

export type LinhaFerias = {
  codigo: string;
  nome: string;
  cargo: string;
  admissao: string | null;
  periodoInicio: string | null;
  periodoFim: string | null;
  dataLimite: string | null;
  proxPeriodoInicio: string | null;
  proxPeriodoFim: string | null;
  clienteRaw: string | null;
  empresa: string | null;
  obra: string | null;
  nomeChave: string;
};

/**
 * Parses the monthly "Férias" export — the file now used for the entire
 * monthly import flow (replaces the old "Funcionários Ativos Geral" file).
 * ";"-delimitado, header row, colunas (todas com padding em espaços, que é
 * removido): CÓDIGO(0) NOME(1) FUNÇÃO(2) ADMISSÃO(3) PER.AQUI.INICIAL(4)
 * PER.AQUI.FINAL(5) DT.LIMITE(6) PROX.PER.INICIAL(7) PROX.PER.FINAL(8)
 * CLIENTE(9). PROX.PER.INICIAL/FINAL são apenas informativos (a projeção do
 * próximo período aquisitivo feita pela planilha) — não usados para criar
 * nada, mas mantidos no tipo para eventual uso futuro. CLIENTE vem como
 * "EMPRESA - OBRA" ou apenas "EMPRESA SA"/"EMPRESA LTDA" (sem obra).
 */
export function parseFeriasCsv(text: string): LinhaFerias[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const rows: LinhaFerias[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(";");
    const nome = (cols[1] ?? "").trim();
    if (!nome) continue;
    const codigo = (cols[0] ?? "").trim();
    const cargo = (cols[2] ?? "").trim();
    const admissao = toDateISO(cols[3]);
    const periodoInicio = toDateISO(cols[4]);
    const periodoFim = toDateISO(cols[5]);
    const dataLimite = toDateISO(cols[6]);
    const proxPeriodoInicio = toDateISO(cols[7]);
    const proxPeriodoFim = toDateISO(cols[8]);
    const clienteRaw = (cols[9] ?? "").trim() || null;
    let empresa: string | null = null;
    let obra: string | null = null;
    if (clienteRaw) {
      const split = splitEmpresaObra(clienteRaw);
      empresa = split.empresa;
      obra = split.obra;
    }
    rows.push({
      codigo,
      nome,
      cargo,
      admissao,
      periodoInicio,
      periodoFim,
      dataLimite,
      proxPeriodoInicio,
      proxPeriodoFim,
      clienteRaw,
      empresa,
      obra,
      nomeChave: normName(nome, true),
    });
  }
  return rows;
}

export type LinhaAtivosGeral = {
  codigo: string;
  nome: string;
  cargo: string;
  admissao: string | null;
  clienteCodigo: string;
  clienteRazaoSocial: string | null;
  empresa: string | null;
  obra: string | null;
  nomeChave: string;
};

const CLIENTES_MAP: Record<string, string> = clientesMap;

/**
 * Parses the "Funcionários Ativos Geral" export. Same layout used in the
 * original Python pipeline (build_data.py): ";"-delimited, header row, with
 * codigo in column A (0), nome in B (1), cargo in E (4), admissão in H (7,
 * dd/mm/yyyy) and o código real do cliente na coluna O (14) — a coluna N
 * ("COD CLIENTE", índice 13) tem um bug de exportação e sempre vem "01", por
 * isso é ignorada.
 */
export function parseAtivosGeralCsv(text: string): LinhaAtivosGeral[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const rows: LinhaAtivosGeral[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(";");
    const nome = (cols[1] ?? "").trim();
    if (!nome) continue;
    const codigo = (cols[0] ?? "").trim();
    const cargo = (cols[4] ?? "").trim();
    const admissao = toDateISO(cols[7]);
    const clienteCodigo = (cols[14] ?? "").trim();
    const clienteRazaoSocial = CLIENTES_MAP[clienteCodigo] ?? null;
    let empresa: string | null = null;
    let obra: string | null = null;
    if (clienteRazaoSocial) {
      const split = splitEmpresaObra(clienteRazaoSocial);
      empresa = split.empresa;
      obra = split.obra;
    }
    rows.push({
      codigo,
      nome,
      cargo,
      admissao,
      clienteCodigo,
      clienteRazaoSocial,
      empresa,
      obra,
      nomeChave: normName(nome, true),
    });
  }
  return rows;
}
