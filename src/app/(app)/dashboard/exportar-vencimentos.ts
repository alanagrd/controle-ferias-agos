// Exportação (Excel + PDF) da lista de férias a vencer do dashboard.
// As libs (exceljs / jspdf) são importadas dinamicamente dentro de cada
// função para não entrarem no bundle inicial — só carregam ao clicar.

export type VencimentoRow = {
  nome: string;
  cliente: string;
  obra: string;
  dataLimite: string; // ISO YYYY-MM-DD
  dias: number; // dias até a data limite (negativo = já vencido)
  saldo: number;
  statusLabel: string;
  afastado: boolean;
};

export type VencimentoResumo = {
  vencidosTrabalhando: number;
  vencidosAfastados: number;
  prox7: number;
  prox30: number;
  prox60: number;
  prox90: number;
};

export type ExportMeta = {
  cliente: string; // "Todos" ou nome do cliente
  janelaLabel: string; // ex.: "Vencem em até 60 dias"
  janelaSlug: string; // ex.: "60dias" (nome do arquivo)
  geradoEm: Date;
  resumo: VencimentoResumo;
};

// --- Paleta AGOS (mesma do globals.css) ---
const AGOS = {
  greenDark: "6A8A2E",
  green: "8BAB3E",
  orange: "E87722",
  charcoal: "2C2C2C",
  white: "FFFFFF",
};

// Tom de fundo (claro) por urgência, para destacar sem poluir.
function fundoUrgencia(dias: number, vencido: boolean): string {
  if (vencido || dias < 0) return "F8D7DA"; // vermelho claro
  if (dias <= 7) return "F8D7DA"; // vermelho claro
  if (dias <= 30) return "FCE3C8"; // laranja claro
  if (dias <= 60) return "FDF3D6"; // âmbar claro
  return "E6EFD4"; // verde claro
}

function fmtDataBR(d: Date): string {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()}`;
}

function fmtDataHoraBR(d: Date): string {
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${fmtDataBR(d)} ${hh}:${mi}`;
}

function baixarBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function nomeArquivo(meta: ExportMeta, ext: string): string {
  const d = meta.geradoEm;
  const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(
    2,
    "0"
  )}${String(d.getDate()).padStart(2, "0")}`;
  return `ferias_${meta.janelaSlug}_${stamp}.${ext}`;
}

// ===================== EXCEL (exceljs) =====================
export async function exportarVencimentosExcel(
  rows: VencimentoRow[],
  meta: ExportMeta
) {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = "Controle Fácil AGOS";
  wb.created = meta.geradoEm;

  const NCOLS = 8;
  const ultimaColLetra = "H";

  // ---------- Aba Vencimentos ----------
  const ws = wb.addWorksheet("Vencimentos", {
    views: [{ state: "frozen", ySplit: 4 }],
  });

  const larguras = [30, 28, 22, 13, 13, 9, 14, 18];
  larguras.forEach((w, i) => (ws.getColumn(i + 1).width = w));

  // Título (linha 1) + subtítulo (linha 2)
  ws.mergeCells(1, 1, 1, NCOLS);
  const tCell = ws.getCell(1, 1);
  tCell.value = "Controle Fácil AGOS — Férias a vencer";
  tCell.font = { bold: true, size: 15, color: { argb: `FF${AGOS.greenDark}` } };
  tCell.alignment = { vertical: "middle" };
  ws.getRow(1).height = 22;

  ws.mergeCells(2, 1, 2, NCOLS);
  const sCell = ws.getCell(2, 1);
  sCell.value = `${meta.janelaLabel}   ·   Cliente: ${meta.cliente}   ·   Gerado em ${fmtDataHoraBR(
    meta.geradoEm
  )}   ·   ${rows.length} registro(s)`;
  sCell.font = { size: 10, color: { argb: "FF6B7280" } };

  // Cabeçalho (linha 4)
  const headers = [
    "Nome",
    "Cliente",
    "Obra/Projeto",
    "Data limite",
    "Dias p/ vencer",
    "Saldo",
    "Status",
    "Situação",
  ];
  const hr = ws.getRow(4);
  headers.forEach((h, i) => {
    const c = hr.getCell(i + 1);
    c.value = h;
    c.font = { bold: true, color: { argb: `FF${AGOS.white}` }, size: 11 };
    c.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: `FF${AGOS.greenDark}` },
    };
    c.alignment = {
      vertical: "middle",
      horizontal: i >= 3 && i <= 5 ? "center" : "left",
    };
    c.border = {
      bottom: { style: "thin", color: { argb: "FF9CA3AF" } },
    };
  });
  hr.height = 18;

  // Dados (a partir da linha 5)
  rows.forEach((r, idx) => {
    const rowIdx = 5 + idx;
    const row = ws.getRow(rowIdx);
    const vencido = r.statusLabel.toLowerCase() === "vencido" || r.dias < 0;

    row.getCell(1).value = r.nome;
    row.getCell(2).value = r.cliente;
    row.getCell(3).value = r.obra || "–";

    const dataCell = row.getCell(4);
    dataCell.value = new Date(r.dataLimite + "T00:00:00");
    dataCell.numFmt = "dd/mm/yyyy";
    dataCell.alignment = { horizontal: "center" };

    const diasCell = row.getCell(5);
    diasCell.value = r.dias;
    diasCell.alignment = { horizontal: "center" };
    diasCell.font = { bold: true };
    diasCell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: `FF${fundoUrgencia(r.dias, vencido)}` },
    };

    const saldoCell = row.getCell(6);
    saldoCell.value = r.saldo;
    saldoCell.alignment = { horizontal: "center" };

    row.getCell(7).value = r.statusLabel;
    row.getCell(8).value = r.afastado ? "Afastado/abandono" : "Trabalhando";

    // zebra + bordas finas
    for (let c = 1; c <= NCOLS; c++) {
      const cell = row.getCell(c);
      cell.border = {
        bottom: { style: "hair", color: { argb: "FFE5E7EB" } },
      };
      if (idx % 2 === 1 && c !== 5) {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFF7F8FA" },
        };
      }
    }
  });

  // Autofiltro cobrindo o cabeçalho + dados
  ws.autoFilter = `A4:${ultimaColLetra}${4 + rows.length}`;

  // ---------- Aba Resumo ----------
  const wr = wb.addWorksheet("Resumo");
  wr.getColumn(1).width = 34;
  wr.getColumn(2).width = 14;
  wr.getColumn(3).width = 16;
  wr.getColumn(4).width = 18;

  wr.mergeCells(1, 1, 1, 4);
  const rt = wr.getCell(1, 1);
  rt.value = "Resumo — Férias a vencer";
  rt.font = { bold: true, size: 14, color: { argb: `FF${AGOS.greenDark}` } };

  wr.mergeCells(2, 1, 2, 4);
  wr.getCell(2, 1).value = `${meta.janelaLabel}  ·  Cliente: ${meta.cliente}  ·  Gerado em ${fmtDataHoraBR(
    meta.geradoEm
  )}`;
  wr.getCell(2, 1).font = { size: 10, color: { argb: "FF6B7280" } };

  const kpis: [string, number][] = [
    ["Períodos vencidos (trabalhando)", meta.resumo.vencidosTrabalhando],
    ["Períodos vencidos (afastado/abandono)", meta.resumo.vencidosAfastados],
    ["Vencem em até 7 dias", meta.resumo.prox7],
    ["Vencem em até 30 dias", meta.resumo.prox30],
    ["Vencem em até 60 dias", meta.resumo.prox60],
    ["Vencem em até 90 dias", meta.resumo.prox90],
    ["Registros neste relatório", rows.length],
  ];
  let linha = 4;
  kpis.forEach(([label, valor]) => {
    const a = wr.getCell(linha, 1);
    a.value = label;
    a.font = { size: 11 };
    const b = wr.getCell(linha, 2);
    b.value = valor;
    b.font = { bold: true, size: 11 };
    b.alignment = { horizontal: "center" };
    linha++;
  });

  // Por cliente (dentro do relatório)
  linha += 1;
  const porClienteHeaderRow = linha;
  const porCliente = new Map<
    string,
    { qtd: number; maisProximo: number }
  >();
  rows.forEach((r) => {
    const atual = porCliente.get(r.cliente) ?? {
      qtd: 0,
      maisProximo: Infinity,
    };
    atual.qtd += 1;
    atual.maisProximo = Math.min(atual.maisProximo, r.dias);
    porCliente.set(r.cliente, atual);
  });

  const headersPC = ["Cliente", "Qtde", "Mais próximo (dias)"];
  headersPC.forEach((h, i) => {
    const c = wr.getCell(porClienteHeaderRow, i + 1);
    c.value = h;
    c.font = { bold: true, color: { argb: `FF${AGOS.white}` } };
    c.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: `FF${AGOS.greenDark}` },
    };
    c.alignment = { horizontal: i === 0 ? "left" : "center" };
  });
  linha = porClienteHeaderRow + 1;
  Array.from(porCliente.entries())
    .sort((a, b) => a[1].maisProximo - b[1].maisProximo)
    .forEach(([cli, v]) => {
      wr.getCell(linha, 1).value = cli;
      wr.getCell(linha, 2).value = v.qtd;
      wr.getCell(linha, 2).alignment = { horizontal: "center" };
      wr.getCell(linha, 3).value = Number.isFinite(v.maisProximo)
        ? v.maisProximo
        : "–";
      wr.getCell(linha, 3).alignment = { horizontal: "center" };
      linha++;
    });

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  baixarBlob(blob, nomeArquivo(meta, "xlsx"));
}

// ===================== PDF (jspdf + autotable) =====================
export async function exportarVencimentosPdf(
  rows: VencimentoRow[],
  meta: ExportMeta
) {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();

  // Cabeçalho
  doc.setFillColor(106, 138, 46); // AGOS green-dark
  doc.rect(0, 0, pageW, 18, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("Controle Fácil AGOS", 14, 8);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Férias a vencer — ${meta.janelaLabel}`, 14, 14);

  doc.setTextColor(60, 60, 60);
  doc.setFontSize(9);
  doc.text(
    `Cliente: ${meta.cliente}   |   Gerado em: ${fmtDataHoraBR(
      meta.geradoEm
    )}   |   ${rows.length} registro(s)`,
    14,
    24
  );

  // Faixa de resumo
  doc.setFontSize(8.5);
  doc.setTextColor(90, 90, 90);
  const r = meta.resumo;
  doc.text(
    `Vencidos (trabalhando): ${r.vencidosTrabalhando}    ·    ≤7d: ${r.prox7}    ·    ≤30d: ${r.prox30}    ·    ≤60d: ${r.prox60}    ·    ≤90d: ${r.prox90}`,
    14,
    29
  );

  autoTable(doc, {
    startY: 33,
    head: [
      [
        "Nome",
        "Cliente",
        "Obra/Projeto",
        "Data limite",
        "Dias",
        "Saldo",
        "Status",
        "Situação",
      ],
    ],
    body: rows.map((row) => [
      row.nome,
      row.cliente,
      row.obra || "-",
      fmtDataBR(new Date(row.dataLimite + "T00:00:00")),
      String(row.dias),
      String(row.saldo),
      row.statusLabel,
      row.afastado ? "Afastado" : "Trabalhando",
    ]),
    styles: { fontSize: 8, cellPadding: 1.5 },
    headStyles: { fillColor: [106, 138, 46], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [247, 248, 250] },
    columnStyles: {
      3: { halign: "center" },
      4: { halign: "center" },
      5: { halign: "center" },
    },
    didParseCell: (data) => {
      // colore a célula "Dias" por urgência
      if (data.section === "body" && data.column.index === 4) {
        const row = rows[data.row.index];
        if (!row) return;
        const vencido =
          row.statusLabel.toLowerCase() === "vencido" || row.dias < 0;
        const hex = fundoUrgencia(row.dias, vencido);
        data.cell.styles.fillColor = [
          parseInt(hex.slice(0, 2), 16),
          parseInt(hex.slice(2, 4), 16),
          parseInt(hex.slice(4, 6), 16),
        ];
        data.cell.styles.fontStyle = "bold";
      }
    },
    didDrawPage: () => {
      const pageCount = doc.getNumberOfPages();
      const pageCurrent = doc.getCurrentPageInfo().pageNumber;
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text(
        `Página ${pageCurrent} de ${pageCount}`,
        pageW - 14,
        doc.internal.pageSize.getHeight() - 8,
        { align: "right" }
      );
    },
  });

  doc.save(nomeArquivo(meta, "pdf"));
}
