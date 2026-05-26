import ExcelJS from "exceljs";
import { formatDate } from "@/lib/utils/format";

export interface EtnReceivedInvoice {
  doc_number: string | null;
  issued_at: Date;
  supplier_name: string;
  payment_method: "faktura" | "hotovost" | "dodaci_list" | "dobirka";
  amount_with_vat: number;
  amount_no_vat: number;
  description: string;
}

export interface EtnIssuedInvoice {
  issued_at: Date;
  amount_with_vat: number;
  amount_no_vat: number;
  payment_method: "fakturace" | "hotovost" | "karta" | "QR";
  short_description: string | null;
  client_name: string;
  external_invoice_number: string | null;
}

export interface EtnReportInput {
  periodStart: Date;
  periodEnd: Date;
  receivedInvoices: EtnReceivedInvoice[];
  issuedInvoices: EtnIssuedInvoice[];
}

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  faktura: "faktura",
  hotovost: "hotovost",
  dodaci_list: "dodací list",
  dobirka: "dobírka",
  fakturace: "fakturace",
  karta: "karta",
  QR: "QR",
};

// === Styling helpers ===
const fontTitle = { name: "Calibri", size: 14, bold: true } as const;
const fontSectionHeader = { name: "Calibri", size: 12, bold: true } as const;
const fontHeader = { name: "Calibri", size: 11, bold: true } as const;
const fontDefault = { name: "Calibri", size: 11 } as const;
const fontSummary = { name: "Calibri", size: 11, bold: true } as const;

const BORDER_COLOR = "FFD0D0D0";
const HEADER_FILL_COLOR = "FFF5F5F5";

const thinBorder: Partial<ExcelJS.Borders> = {
  top: { style: "thin", color: { argb: BORDER_COLOR } },
  left: { style: "thin", color: { argb: BORDER_COLOR } },
  bottom: { style: "thin", color: { argb: BORDER_COLOR } },
  right: { style: "thin", color: { argb: BORDER_COLOR } },
};

const headerFill: ExcelJS.FillPattern = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: HEADER_FILL_COLOR },
};

function colLetter(col: number): string {
  let n = col;
  let s = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function applyBorderRange(
  sheet: ExcelJS.Worksheet,
  rowStart: number,
  rowEnd: number,
  colStart: number,
  colEnd: number,
) {
  for (let r = rowStart; r <= rowEnd; r++) {
    for (let c = colStart; c <= colEnd; c++) {
      sheet.getCell(r, c).border = thinBorder;
    }
  }
}

function applyHeaderFillRange(
  sheet: ExcelJS.Worksheet,
  rowStart: number,
  rowEnd: number,
  colStart: number,
  colEnd: number,
) {
  for (let r = rowStart; r <= rowEnd; r++) {
    for (let c = colStart; c <= colEnd; c++) {
      sheet.getCell(r, c).fill = headerFill;
    }
  }
}

export async function generateEtnXlsx(input: EtnReportInput): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Fokus tisk fakturační systém";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("ETN");

  // === Šířky sloupců ===
  sheet.getColumn(1).width = 22; // číslo dokladu IS Lupa NET / Datum
  sheet.getColumn(2).width = 14; // datum / tržby s DPH
  sheet.getColumn(3).width = 24; // dodavatel / tržby bez DPH
  sheet.getColumn(4).width = 14; // platba / hotovost
  sheet.getColumn(5).width = 16; // s DPH / karta
  sheet.getColumn(6).width = 16; // bez DPH / fakturace
  sheet.getColumn(7).width = 28; // popis / QR
  sheet.getColumn(8).width = 28; // (tržby) popis

  // === HLAVIČKA ===
  sheet.mergeCells("A1:G1");
  const titleCell = sheet.getCell("A1");
  titleCell.value = "EVIDENCE VYÚČTOVÁNÍ TRŽEB A NÁKLADŮ PROVOZOVNY:";
  titleCell.font = fontTitle;
  titleCell.alignment = { vertical: "middle" };
  titleCell.fill = headerFill;

  sheet.mergeCells("H1:I1");
  const provozovnaCell = sheet.getCell("H1");
  provozovnaCell.value = "Fokus tisk";
  provozovnaCell.font = fontTitle;
  provozovnaCell.alignment = { horizontal: "left", vertical: "middle" };
  provozovnaCell.fill = headerFill;

  sheet.getRow(1).height = 22;

  const periodCell = sheet.getCell("A2");
  periodCell.value = `Období: ${formatDate(input.periodStart)} – ${formatDate(
    input.periodEnd,
  )}`;
  periodCell.font = fontDefault;
  sheet.getRow(2).height = 16;

  // === SEKCE NÁKLADY ===
  const nakladyHeaderRow = 4;
  sheet.getCell(`A${nakladyHeaderRow}`).value = "NÁKLADY";
  sheet.getCell(`A${nakladyHeaderRow}`).font = fontSectionHeader;
  sheet.getRow(nakladyHeaderRow).height = 20;

  const nakladyColsRow = nakladyHeaderRow + 1;
  const nakladyHeaders = [
    "číslo dokladu IS Lupa NET",
    "datum",
    "dodavatel",
    "platba",
    "náklady s DPH",
    "náklady bez DPH",
    "stručný popis nákladů",
  ];

  nakladyHeaders.forEach((header, i) => {
    const cell = sheet.getCell(nakladyColsRow, i + 1);
    cell.value = header;
    cell.font = fontHeader;
    cell.alignment = {
      horizontal: "center",
      vertical: "middle",
      wrapText: true,
    };
  });
  sheet.getRow(nakladyColsRow).height = 32;
  applyHeaderFillRange(sheet, nakladyColsRow, nakladyColsRow, 1, 7);
  applyBorderRange(sheet, nakladyColsRow, nakladyColsRow, 1, 7);

  const nakladySumRow = nakladyColsRow + 1;
  const nakladyDataStart = nakladySumRow + 1;

  input.receivedInvoices.forEach((inv, idx) => {
    const r = nakladyDataStart + idx;
    sheet.getCell(r, 1).value = inv.doc_number ?? "";
    sheet.getCell(r, 1).alignment = { horizontal: "left", vertical: "middle" };
    sheet.getCell(r, 2).value = inv.issued_at;
    sheet.getCell(r, 2).numFmt = "d.m.yyyy";
    sheet.getCell(r, 2).alignment = { horizontal: "left", vertical: "middle" };
    sheet.getCell(r, 3).value = inv.supplier_name;
    sheet.getCell(r, 3).alignment = { horizontal: "left", vertical: "middle" };
    sheet.getCell(r, 4).value =
      PAYMENT_METHOD_LABELS[inv.payment_method] ?? inv.payment_method;
    sheet.getCell(r, 4).alignment = {
      horizontal: "center",
      vertical: "middle",
    };
    sheet.getCell(r, 5).value = inv.amount_with_vat;
    sheet.getCell(r, 5).numFmt = "#,##0.00";
    sheet.getCell(r, 5).alignment = { horizontal: "right", vertical: "middle" };
    sheet.getCell(r, 6).value = inv.amount_no_vat;
    sheet.getCell(r, 6).numFmt = "#,##0.00";
    sheet.getCell(r, 6).alignment = { horizontal: "right", vertical: "middle" };
    sheet.getCell(r, 7).value = inv.description;
    sheet.getCell(r, 7).alignment = {
      horizontal: "left",
      vertical: "middle",
      wrapText: true,
    };
    for (let c = 1; c <= 7; c++) {
      sheet.getCell(r, c).font = fontDefault;
    }
  });

  const nakladyDataEnd =
    nakladyDataStart + Math.max(input.receivedInvoices.length - 1, 0);

  if (input.receivedInvoices.length > 0) {
    sheet.getCell(nakladySumRow, 5).value = {
      formula: `SUM(E${nakladyDataStart}:E${nakladyDataEnd})`,
    };
    sheet.getCell(nakladySumRow, 5).numFmt = "#,##0.00";
    sheet.getCell(nakladySumRow, 5).font = fontSummary;
    sheet.getCell(nakladySumRow, 5).alignment = {
      horizontal: "right",
      vertical: "middle",
    };
    sheet.getCell(nakladySumRow, 6).value = {
      formula: `SUM(F${nakladyDataStart}:F${nakladyDataEnd})`,
    };
    sheet.getCell(nakladySumRow, 6).numFmt = "#,##0.00";
    sheet.getCell(nakladySumRow, 6).font = fontSummary;
    sheet.getCell(nakladySumRow, 6).alignment = {
      horizontal: "right",
      vertical: "middle",
    };
    applyHeaderFillRange(sheet, nakladySumRow, nakladySumRow, 1, 7);
    applyBorderRange(sheet, nakladySumRow, nakladySumRow, 1, 7);
    applyBorderRange(sheet, nakladyDataStart, nakladyDataEnd, 1, 7);
  }

  // === SEKCE TRŽBY ===
  const trzbyHeaderRow =
    (input.receivedInvoices.length > 0 ? nakladyDataEnd : nakladySumRow) + 3;
  sheet.getCell(`A${trzbyHeaderRow}`).value = "TRŽBY";
  sheet.getCell(`A${trzbyHeaderRow}`).font = fontSectionHeader;
  sheet.getRow(trzbyHeaderRow).height = 20;

  const trzbyColsRow = trzbyHeaderRow + 1;
  sheet.getCell(trzbyColsRow, 1).value = "Datum";
  sheet.getCell(trzbyColsRow, 2).value = "tržby s DPH";
  sheet.getCell(trzbyColsRow, 3).value = "tržby bez DPH";

  sheet.mergeCells(trzbyColsRow, 4, trzbyColsRow, 7);
  sheet.getCell(trzbyColsRow, 4).value = "z toho tržby s DPH";
  sheet.getCell(trzbyColsRow, 4).alignment = {
    horizontal: "center",
    vertical: "middle",
  };

  sheet.getCell(trzbyColsRow, 8).value = "stručný popis tržeb";

  [1, 2, 3, 4, 8].forEach((c) => {
    sheet.getCell(trzbyColsRow, c).font = fontHeader;
    if (c !== 4) {
      sheet.getCell(trzbyColsRow, c).alignment = {
        horizontal: "center",
        vertical: "middle",
        wrapText: true,
      };
    }
  });
  sheet.getRow(trzbyColsRow).height = 24;
  applyHeaderFillRange(sheet, trzbyColsRow, trzbyColsRow, 1, 8);
  applyBorderRange(sheet, trzbyColsRow, trzbyColsRow, 1, 8);

  // Druhý řádek hlavičky (sub-cols pod "z toho tržby s DPH")
  const trzbySubRow = trzbyColsRow + 1;
  sheet.getCell(trzbySubRow, 4).value = "hotovost";
  sheet.getCell(trzbySubRow, 5).value = "karta";
  sheet.getCell(trzbySubRow, 6).value = "fakturace";
  sheet.getCell(trzbySubRow, 7).value = "QR";
  [4, 5, 6, 7].forEach((c) => {
    sheet.getCell(trzbySubRow, c).font = fontHeader;
    sheet.getCell(trzbySubRow, c).alignment = {
      horizontal: "center",
      vertical: "middle",
    };
  });
  applyHeaderFillRange(sheet, trzbySubRow, trzbySubRow, 1, 8);
  applyBorderRange(sheet, trzbySubRow, trzbySubRow, 1, 8);

  const trzbySumRow = trzbySubRow + 1;
  const trzbyDataStart = trzbySumRow + 1;

  const PAYMENT_COL: Record<string, number> = {
    hotovost: 4,
    karta: 5,
    fakturace: 6,
    QR: 7,
  };

  input.issuedInvoices.forEach((inv, idx) => {
    const r = trzbyDataStart + idx;
    sheet.getCell(r, 1).value = inv.issued_at;
    sheet.getCell(r, 1).numFmt = "d.m.yyyy";
    sheet.getCell(r, 1).alignment = { horizontal: "left", vertical: "middle" };
    sheet.getCell(r, 2).value = inv.amount_with_vat;
    sheet.getCell(r, 2).numFmt = "#,##0.00";
    sheet.getCell(r, 2).alignment = { horizontal: "right", vertical: "middle" };
    sheet.getCell(r, 3).value = inv.amount_no_vat;
    sheet.getCell(r, 3).numFmt = "#,##0.00";
    sheet.getCell(r, 3).alignment = { horizontal: "right", vertical: "middle" };

    const targetCol = PAYMENT_COL[inv.payment_method] ?? 6;
    sheet.getCell(r, targetCol).value = inv.amount_with_vat;
    sheet.getCell(r, targetCol).numFmt = "#,##0.00";
    sheet.getCell(r, targetCol).alignment = {
      horizontal: "right",
      vertical: "middle",
    };

    sheet.getCell(r, 8).value =
      inv.short_description ||
      (inv.external_invoice_number
        ? `FV ${inv.external_invoice_number}`
        : inv.client_name);
    sheet.getCell(r, 8).alignment = {
      horizontal: "left",
      vertical: "middle",
      wrapText: true,
    };
    for (let c = 1; c <= 8; c++) {
      sheet.getCell(r, c).font = fontDefault;
    }
  });

  const trzbyDataEnd =
    trzbyDataStart + Math.max(input.issuedInvoices.length - 1, 0);

  if (input.issuedInvoices.length > 0) {
    sheet.getCell(trzbySumRow, 2).value = {
      formula: `SUM(B${trzbyDataStart}:B${trzbyDataEnd})`,
    };
    sheet.getCell(trzbySumRow, 2).numFmt = "#,##0.00";
    sheet.getCell(trzbySumRow, 2).font = fontSummary;
    sheet.getCell(trzbySumRow, 2).alignment = {
      horizontal: "right",
      vertical: "middle",
    };
    sheet.getCell(trzbySumRow, 3).value = {
      formula: `SUM(C${trzbyDataStart}:C${trzbyDataEnd})`,
    };
    sheet.getCell(trzbySumRow, 3).numFmt = "#,##0.00";
    sheet.getCell(trzbySumRow, 3).font = fontSummary;
    sheet.getCell(trzbySumRow, 3).alignment = {
      horizontal: "right",
      vertical: "middle",
    };

    [4, 5, 6, 7].forEach((c) => {
      const letter = colLetter(c);
      sheet.getCell(trzbySumRow, c).value = {
        formula: `SUM(${letter}${trzbyDataStart}:${letter}${trzbyDataEnd})`,
      };
      sheet.getCell(trzbySumRow, c).numFmt = "#,##0.00";
      sheet.getCell(trzbySumRow, c).font = fontSummary;
      sheet.getCell(trzbySumRow, c).alignment = {
        horizontal: "right",
        vertical: "middle",
      };
    });
    applyHeaderFillRange(sheet, trzbySumRow, trzbySumRow, 1, 8);
    applyBorderRange(sheet, trzbySumRow, trzbySumRow, 1, 8);
    applyBorderRange(sheet, trzbyDataStart, trzbyDataEnd, 1, 8);
  }

  // === SHRNUTÍ DOLE (Vyúčtování hotovosti) ===
  const summaryRow =
    (input.issuedInvoices.length > 0 ? trzbyDataEnd : trzbySumRow) + 3;
  sheet.getCell(`A${summaryRow}`).value = "Vyúčtování hotovosti:";
  sheet.getCell(`A${summaryRow}`).font = fontSummary;

  sheet.getCell(`C${summaryRow}`).value = "Náklady s DPH:";
  sheet.getCell(`C${summaryRow}`).font = fontSummary;
  sheet.getCell(`D${summaryRow}`).value =
    input.receivedInvoices.length > 0
      ? { formula: `E${nakladySumRow}` }
      : 0;
  sheet.getCell(`D${summaryRow}`).numFmt = "#,##0.00";
  sheet.getCell(`D${summaryRow}`).font = fontSummary;
  sheet.getCell(`D${summaryRow}`).alignment = {
    horizontal: "right",
    vertical: "middle",
  };

  sheet.getCell(`F${summaryRow}`).value = "Tržby s DPH:";
  sheet.getCell(`F${summaryRow}`).font = fontSummary;
  sheet.getCell(`G${summaryRow}`).value =
    input.issuedInvoices.length > 0 ? { formula: `B${trzbySumRow}` } : 0;
  sheet.getCell(`G${summaryRow}`).numFmt = "#,##0.00";
  sheet.getCell(`G${summaryRow}`).font = fontSummary;
  sheet.getCell(`G${summaryRow}`).alignment = {
    horizontal: "right",
    vertical: "middle",
  };

  applyHeaderFillRange(sheet, summaryRow, summaryRow, 1, 7);
  applyBorderRange(sheet, summaryRow, summaryRow, 1, 7);

  // Podpisy
  const signRow = summaryRow + 3;
  sheet.getCell(`C${signRow}`).value = "Schválil";
  sheet.getCell(`C${signRow}`).font = fontDefault;
  sheet.getCell(`E${signRow}`).value = "Předal";
  sheet.getCell(`E${signRow}`).font = fontDefault;
  sheet.getCell(`G${signRow}`).value = "Převzal";
  sheet.getCell(`G${signRow}`).font = fontDefault;

  const weekRow = signRow + 3;
  sheet.getCell(`A${weekRow}`).value = "Předpokládané datum vyúčtování:";
  sheet.getCell(`A${weekRow}`).font = fontDefault;

  // Freeze pane — title + období + NÁKLADY label
  sheet.views = [{ state: "frozen", xSplit: 0, ySplit: 4 }];

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
