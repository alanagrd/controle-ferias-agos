import * as XLSX from "xlsx";

export type LinhaExportacaoVt = {
  clienteCodigo: string | null;
  obra: string | null;
  matricula: string | null;
  nome: string;
  valorDiario: number | null;
  dias: number | null;
  totalVt: number;
  vr: number | null;
  reembolsoVt: number;
  descontoVt: number;
  h50: number;
  h70: number;
  h100: number;
  faltas: number;
  dsr: number;
  adNot: number;
  premio: number;
};

/**
 * Gera o .xlsx no mesmo layout da planilha VT_RIO histórica (Cod / Obra /
 * Matr / Nome / V.Unitario / Qtd / Total VT / Vr / Reembolso / 50% / 70% /
 * 100% / Faltas / Desc.DSR / Ad.Not / Premio), ordenado por obra e nome —
 * para o admin de cada obra preencher o apontamento do jeito que já conhece.
 */
export function exportarPlanilhaVt(
  linhas: LinhaExportacaoVt[],
  nomeArquivo: string
) {
  const ordenadas = [...linhas].sort((a, b) => {
    const obraA = a.obra ?? "";
    const obraB = b.obra ?? "";
    if (obraA !== obraB) return obraA.localeCompare(obraB, "pt-BR");
    return a.nome.localeCompare(b.nome, "pt-BR");
  });

  const aoa: (string | number | null)[][] = [
    [
      "Cod",
      "Obra",
      "Matr",
      "Nome",
      "V. Unitario",
      "Qtd",
      "Total VT",
      "Vr",
      "Reembolso VT",
      "Desconto VT",
      "50%",
      "70%",
      "100%",
      "Faltas",
      "Desc. DSR",
      "Ad.Not",
      "Premio",
    ],
    ...ordenadas.map((l) => [
      l.clienteCodigo,
      l.obra,
      l.matricula,
      l.nome,
      l.valorDiario,
      l.dias,
      l.totalVt,
      l.vr,
      l.reembolsoVt || null,
      l.descontoVt || null,
      l.h50 || null,
      l.h70 || null,
      l.h100 || null,
      l.faltas || null,
      l.dsr || null,
      l.adNot || null,
      l.premio || null,
    ]),
  ];

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = [
    { wch: 8 }, { wch: 16 }, { wch: 8 }, { wch: 32 }, { wch: 10 },
    { wch: 6 }, { wch: 12 }, { wch: 10 }, { wch: 12 }, { wch: 12 },
    { wch: 6 }, { wch: 6 }, { wch: 7 }, { wch: 7 }, { wch: 9 },
    { wch: 7 }, { wch: 7 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "VT");
  XLSX.writeFile(wb, nomeArquivo);
}
