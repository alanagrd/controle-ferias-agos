/**
 * Parser da planilha "Funcionários Ativos" (export do Bitti) usada pela
 * conciliação mensal do módulo VT. Mesmo tipo de export que o ASO usa
 * (windows-1252, ";"-delimitado, header row), mas com layout mais enxuto
 * — sem colunas de demissão, já que é uma lista só de ativos:
 * CÓDIGO(0) NOME(1) FUNÇÃO(2) SALARIO(3) C. CUSTO(4) ADMISSÃO(5)
 * COD CLIENTE(6) CLIENTE(7).
 *
 * A coluna C. CUSTO já vem no mesmo formato usado como `obra` no VT
 * (ex.: "01-ANGRA-120", "02-CEDAE-076") — é o que permite detectar
 * transferência de centro de custo direto, sem mapeamento extra.
 * Alguns valores de C. CUSTO não são obra de verdade (ex. "AFASTADO",
 * "AFASTADO/ABANDONO") — ficam de fora da comparação de centro de custo,
 * mas a pessoa continua contando para fins de ativo/dispensado.
 */
export type LinhaAtivoVt = {
  codigo: string; // sem zero à esquerda, como vem no arquivo
  nome: string;
  funcao: string;
  ccusto: string;
  admissao: string | null;
  clienteCodigo: string;
  cliente: string | null;
};

function toDateISO(br: string | undefined): string | null {
  if (!br) return null;
  const m = br.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const [, d, mo, y] = m;
  return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

export async function parseAtivosVtFile(
  file: File
): Promise<{ linhas: LinhaAtivoVt[]; avisos: string[] }> {
  const buf = await file.arrayBuffer();
  const text = new TextDecoder("windows-1252").decode(buf);
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const avisos: string[] = [];

  if (lines.length === 0) {
    return { linhas: [], avisos: ["Arquivo vazio."] };
  }

  const header = lines[0].toUpperCase();
  if (!header.includes("CÓDIGO") && !header.includes("CODIGO")) {
    avisos.push(
      "A primeira linha não parece ser o cabeçalho esperado (CÓDIGO;NOME;...). Conferindo mesmo assim."
    );
  }

  const linhas: LinhaAtivoVt[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(";");
    const nome = (cols[1] ?? "").trim();
    if (!nome) continue;
    const codigo = (cols[0] ?? "").replace(/[\r\x0c]/g, "").trim();
    if (!/^\d+$/.test(codigo)) continue;

    linhas.push({
      codigo,
      nome,
      funcao: (cols[2] ?? "").trim(),
      ccusto: (cols[4] ?? "").trim(),
      admissao: toDateISO(cols[5]),
      clienteCodigo: (cols[6] ?? "").trim(),
      cliente: (cols[7] ?? "").trim() || null,
    });
  }

  return { linhas, avisos };
}
