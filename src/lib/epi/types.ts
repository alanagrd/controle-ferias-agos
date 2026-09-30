export type EpiCatalogoItem = {
  id: string;
  descricao: string;
  ca: string | null;
  validade: string | null; // "YYYY-MM-DD"
  sinonimos: string[];
  ativo: boolean;
};

export type EpiItem = { descricao: string; qtd: number };

export type EpiModelo = {
  id: string;
  funcao: string;
  itens: EpiItem[];
  ativo: boolean;
};

/** Normaliza descrição de EPI para casar variações (acentos, espaços, caixa). */
export function normalizaDescricao(s: string): string {
  return (s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Resolve o item do catálogo (C.A / validade) pela descrição ou por um sinônimo. */
export function resolverCatalogo(
  descricao: string,
  catalogo: EpiCatalogoItem[]
): EpiCatalogoItem | null {
  const n = normalizaDescricao(descricao);
  for (const c of catalogo) {
    if (normalizaDescricao(c.descricao) === n) return c;
    if (c.sinonimos?.some((s) => normalizaDescricao(s) === n)) return c;
  }
  return null;
}

/** true se a validade (YYYY-MM-DD) já passou. */
export function caVencido(validade: string | null): boolean {
  if (!validade) return false;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const [y, m, d] = validade.split("-").map(Number);
  return new Date(y, m - 1, d) < hoje;
}
