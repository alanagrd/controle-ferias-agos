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
