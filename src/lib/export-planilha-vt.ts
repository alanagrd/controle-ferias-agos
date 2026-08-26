/**
 * Gera a planilha de VT (formato "VT RIO.xlsx") para enviar aos ADMs das obras
 * preencherem o apontamento do mês. Reproduz o layout original:
 * - mesmos cabeçalhos (o parser de reimportação em importacao-vt.ts casa por
 *   esses nomes — NÃO alterar sem ajustar lá);
 * - cabeçalho azul-escuro, filtros (autofilter), painel congelado, larguras;
 * - fórmulas de Total VT / Total M.A / Valor Desc VT (só p/ a obra visualizar —
 *   a reimportação lê as colunas cruas, não os totais);
 * - colunas que a obra preenche destacadas em âmbar claro.
 *
 * Pré-preenchido pelo sistema: Cod(—), Obra, Matr, Nome, V.Unitário, Qtd(dias),
 * VR e Cesta. O resto do apontamento fica em branco/destacado.
 */
import type ExcelJS from "exceljs";

export type LinhaPlanilhaVt = {
  cod: string | null;
  obra: string | null;
  matricula: string | null; // não-padded, ex.: "3787"
  nome: string;
  valorDiario: number | null;
  dias: number | null;
  vr: number | null;
  cesta: number | null;
};

const MES_NOMES = [
  "JANEIRO", "FEVEREIRO", "MARÇO", "ABRIL", "MAIO", "JUNHO",
  "JULHO", "AGOSTO", "SETEMBRO", "OUTUBRO", "NOVEMBRO", "DEZEMBRO",
];

// Cabeçalhos EXATOS da planilha original (24 colunas, A..X).
const HEADERS = [
  "Cod", "Obra", "Matr", "Nome", "Coluna1", "V. Unitario", "Qtd",
  "Total VT  276", "Sabados", "Total M.A  271", "QTD Desc  VT",
  "Valor Desc  VT 903", "Reembolso  901", "Vr  277", "Cesta  278 ",
  "Vr M.A  274", "Vr M.A  904 AGOS", "50%  150", "70%  146", "100%  153",
  "Faltas  553", "Desc. DSR  191", "Ad.Not  184", "Premio  909",
];

const WIDTHS = [
  11, 25, 11, 40, 12, 14, 9, 16, 10, 16, 11, 16, 16, 14, 16, 14, 16, 10, 10, 10,
  10, 12, 10, 10,
];

const AZUL = "FF203864";
const AMBAR = "FFFFF3D6";

// 1-based: colunas monetárias / de dias / preenchidas pela obra.
const COLS_MOEDA = new Set([6, 8, 10, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24]);
const COLS_INT = new Set([7, 9, 11]);
const COLS_PREENCHER = new Set([7, 9, 11, 13, 16, 17, 18, 19, 20, 21, 22, 23, 24]);

function bordaFina(): Partial<ExcelJS.Borders> {
  const s = { style: "thin" as const, color: { argb: "FFD9D9D9" } };
  return { top: s, left: s, bottom: s, right: s };
}

export async function exportarPlanilhaVtParaObras(
  ano: number,
  mes: number,
  linhas: LinhaPlanilhaVt[],
  nomeArquivo: string
): Promise<void> {
  const ExcelJSmod = (await import("exceljs")).default;
  const wb = new ExcelJSmod.Workbook();
  const nomeAba = `PARA ${MES_NOMES[mes - 1]} ${ano}`;
  const ws = wb.addWorksheet(nomeAba, {
    views: [{ state: "frozen", xSplit: 4, ySplit: 6 }],
  });

  WIDTHS.forEach((w, i) => (ws.getColumn(i + 1).width = w));

  const last = 6 + Math.max(linhas.length, 1);

  // --- Totais no topo ---
  const totais: [string, string, boolean][] = [
    ["TOTAL FUNCIONÁRIOS", `COUNTA(D7:D${last})`, false],
    ["TOTAL VALE TRANSPORTE", `SUM(H7:H${last})`, true],
    ["TOTAL REEMBOLSO VT", `SUM(J7:J${last})`, true],
    ["TOTAL CESTA BÁSICA", `SUM(O7:O${last})`, true],
  ];
  totais.forEach(([label, formula, moeda], idx) => {
    const r = idx + 1;
    ws.mergeCells(r, 1, r, 2);
    const lc = ws.getCell(r, 1);
    lc.value = label;
    lc.font = { bold: true, size: 10 };
    lc.alignment = { horizontal: "right", vertical: "middle" };
    const vc = ws.getCell(r, 3);
    vc.value = { formula };
    vc.font = { bold: true, size: 10 };
    if (moeda) vc.numFmt = "#,##0.00";
  });

  // --- Título ---
  ws.mergeCells(1, 5, 4, 11);
  const tc = ws.getCell(1, 5);
  tc.value = `CONTROLE DE VALE TRANSPORTE\n${nomeAba}`;
  tc.font = { bold: true, size: 16, color: { argb: AZUL } };
  tc.alignment = { horizontal: "center", vertical: "middle", wrapText: true };

  // --- Cabeçalho (linha 6) ---
  const hr = ws.getRow(6);
  HEADERS.forEach((h, i) => {
    const cell = hr.getCell(i + 1);
    cell.value = h;
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: AZUL } };
    cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 9 };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.border = bordaFina();
  });
  hr.height = 30;

  // --- Dados (linha 7+) ---
  linhas.forEach((ln, i) => {
    const r = 7 + i;
    const row = ws.getRow(r);
    row.getCell(1).value = ln.cod;
    row.getCell(2).value = ln.obra;
    row.getCell(3).value = ln.matricula ? Number(ln.matricula) : null;
    row.getCell(4).value = ln.nome;
    row.getCell(6).value = ln.valorDiario;
    row.getCell(7).value = ln.dias;
    row.getCell(8).value = { formula: `F${r}*G${r}` }; // Total VT
    row.getCell(10).value = { formula: `F${r}*I${r}` }; // Total M.A
    row.getCell(12).value = { formula: `K${r}*F${r}` }; // Valor Desc VT
    row.getCell(14).value = ln.vr;
    row.getCell(15).value = ln.cesta;

    for (let c = 1; c <= 24; c++) {
      const cell = row.getCell(c);
      cell.border = bordaFina();
      if (COLS_MOEDA.has(c)) cell.numFmt = "#,##0.00";
      else if (COLS_INT.has(c)) cell.numFmt = "0";
      if (COLS_PREENCHER.has(c))
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: AMBAR } };
    }
  });

  ws.autoFilter = { from: { row: 6, column: 1 }, to: { row: 6, column: 24 } };

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nomeArquivo;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
