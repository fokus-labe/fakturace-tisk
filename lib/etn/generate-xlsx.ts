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

export async function generateEtnXlsx(input: EtnReportInput): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Fokus tisk fakturační systém";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("ETN", {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  const fontDefault = { name: "Calibri", size: 11 };
  const fontBold = { ...fontDefault, bold: true };
  const fontHeader = { ...fontBold, size: 12 };

  // === HLAVIČKA ===
  sheet.mergeCells("A1:G1");
  const titleCell = sheet.getCell("A1");
  titleCell.value = "EVIDENCE VYÚČTOVÁNÍ TRŽEB A NÁKLADŮ PROVOZOVNY:";
  titleCell.font = { ...fontHeader, bold: true };

  sheet.mergeCells("H1:I1");
  const provozovnaCell = sheet.getCell("H1");
  provozovnaCell.value = "Fokus tisk";
  provozovnaCell.font = fontHeader;
  provozovnaCell.alignment = { horizontal: "left" };

  sheet.getCell("A2").value = `Období: ${formatDate(
    input.periodStart,
  )} – ${formatDate(input.periodEnd)}`;
  sheet.getCell("A2").font = fontDefault;

  // === SEKCE NÁKLADY ===
  const nakladyHeaderRow = 4;
  sheet.getCell(`A${nakladyHeaderRow}`).value = "NÁKLADY";
  sheet.getCell(`A${nakladyHeaderRow}`).font = { ...fontBold, size: 12 };

  const nakladyColsRow = nakladyHeaderRow + 1;
  const nakladyCols = [
    { header: "číslo dokladu  IS Lupa NET", width: 16 },
    { header: "datum", width: 12 },
    { header: "dodavatel", width: 22 },
    { header: "platba", width: 12 },
    { header: "náklady  s DPH", width: 14 },
    { header: "náklady  bez DPH", width: 14 },
    { header: "stručný popis  nákladů", width: 28 },
  ];

  nakladyCols.forEach((col, i) => {
    const cell = sheet.getCell(nakladyColsRow, i + 1);
    cell.value = col.header;
    cell.font = fontBold;
    cell.alignment = { wrapText: true, vertical: "middle" };
    sheet.getColumn(i + 1).width = col.width;
  });

  // Sumy nahoře (jako v šabloně)
  const nakladySumRow = nakladyColsRow + 1;

  // Data náklady
  const nakladyDataStart = nakladySumRow + 1;
  input.receivedInvoices.forEach((inv, idx) => {
    const r = nakladyDataStart + idx;
    sheet.getCell(r, 1).value = inv.doc_number ?? "";
    sheet.getCell(r, 2).value = inv.issued_at;
    sheet.getCell(r, 2).numFmt = "d.m.yyyy";
    sheet.getCell(r, 3).value = inv.supplier_name;
    sheet.getCell(r, 4).value =
      PAYMENT_METHOD_LABELS[inv.payment_method] ?? inv.payment_method;
    sheet.getCell(r, 5).value = inv.amount_with_vat;
    sheet.getCell(r, 5).numFmt = "#,##0.00";
    sheet.getCell(r, 6).value = inv.amount_no_vat;
    sheet.getCell(r, 6).numFmt = "#,##0.00";
    sheet.getCell(r, 7).value = inv.description;
  });

  const nakladyDataEnd =
    nakladyDataStart + Math.max(input.receivedInvoices.length - 1, 0);

  if (input.receivedInvoices.length > 0) {
    sheet.getCell(nakladySumRow, 5).value = {
      formula: `SUM(E${nakladyDataStart}:E${nakladyDataEnd})`,
    };
    sheet.getCell(nakladySumRow, 5).numFmt = "#,##0.00";
    sheet.getCell(nakladySumRow, 5).font = fontBold;
    sheet.getCell(nakladySumRow, 6).value = {
      formula: `SUM(F${nakladyDataStart}:F${nakladyDataEnd})`,
    };
    sheet.getCell(nakladySumRow, 6).numFmt = "#,##0.00";
    sheet.getCell(nakladySumRow, 6).font = fontBold;
  }

  // === SEKCE TRŽBY ===
  const trzbyHeaderRow =
    (input.receivedInvoices.length > 0 ? nakladyDataEnd : nakladySumRow) + 3;
  sheet.getCell(`A${trzbyHeaderRow}`).value = "TRŽBY";
  sheet.getCell(`A${trzbyHeaderRow}`).font = { ...fontBold, size: 12 };

  const trzbyColsRow = trzbyHeaderRow + 1;
  sheet.getCell(trzbyColsRow, 1).value = "Datum";
  sheet.getCell(trzbyColsRow, 1).font = fontBold;
  sheet.getCell(trzbyColsRow, 2).value = "tržby  s DPH";
  sheet.getCell(trzbyColsRow, 2).font = fontBold;
  sheet.getCell(trzbyColsRow, 3).value = "tržby  bez DPH";
  sheet.getCell(trzbyColsRow, 3).font = fontBold;

  sheet.mergeCells(trzbyColsRow, 4, trzbyColsRow, 7);
  sheet.getCell(trzbyColsRow, 4).value = "z toho tržby s DPH";
  sheet.getCell(trzbyColsRow, 4).font = fontBold;
  sheet.getCell(trzbyColsRow, 4).alignment = { horizontal: "center" };

  sheet.getCell(trzbyColsRow, 8).value = "stručný popis  tržeb";
  sheet.getCell(trzbyColsRow, 8).font = fontBold;
  sheet.getColumn(8).width = 28;

  // Druhý řádek hlavičky (sub-cols)
  const trzbySubRow = trzbyColsRow + 1;
  sheet.getCell(trzbySubRow, 4).value = "hotovost";
  sheet.getCell(trzbySubRow, 5).value = "karta";
  sheet.getCell(trzbySubRow, 6).value = "fakturace";
  sheet.getCell(trzbySubRow, 7).value = "QR";
  [4, 5, 6, 7].forEach((c) => {
    sheet.getCell(trzbySubRow, c).font = fontBold;
    sheet.getCell(trzbySubRow, c).alignment = { horizontal: "center" };
  });

  const trzbySumRow = trzbySubRow + 1;

  // Data tržby
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
    sheet.getCell(r, 2).value = inv.amount_with_vat;
    sheet.getCell(r, 2).numFmt = "#,##0.00";
    sheet.getCell(r, 3).value = inv.amount_no_vat;
    sheet.getCell(r, 3).numFmt = "#,##0.00";

    const targetCol = PAYMENT_COL[inv.payment_method] ?? 6;
    sheet.getCell(r, targetCol).value = inv.amount_with_vat;
    sheet.getCell(r, targetCol).numFmt = "#,##0.00";

    sheet.getCell(r, 8).value =
      inv.short_description ||
      (inv.external_invoice_number
        ? `FV ${inv.external_invoice_number}`
        : inv.client_name);
  });

  const trzbyDataEnd =
    trzbyDataStart + Math.max(input.issuedInvoices.length - 1, 0);

  if (input.issuedInvoices.length > 0) {
    sheet.getCell(trzbySumRow, 2).value = {
      formula: `SUM(B${trzbyDataStart}:B${trzbyDataEnd})`,
    };
    sheet.getCell(trzbySumRow, 2).numFmt = "#,##0.00";
    sheet.getCell(trzbySumRow, 2).font = fontBold;
    sheet.getCell(trzbySumRow, 3).value = {
      formula: `SUM(C${trzbyDataStart}:C${trzbyDataEnd})`,
    };
    sheet.getCell(trzbySumRow, 3).numFmt = "#,##0.00";
    sheet.getCell(trzbySumRow, 3).font = fontBold;

    [4, 5, 6, 7].forEach((c) => {
      const letter = colLetter(c);
      sheet.getCell(trzbySumRow, c).value = {
        formula: `SUM(${letter}${trzbyDataStart}:${letter}${trzbyDataEnd})`,
      };
      sheet.getCell(trzbySumRow, c).numFmt = "#,##0.00";
      sheet.getCell(trzbySumRow, c).font = fontBold;
    });
  }

  // === SHRNUTÍ DOLE (Vyúčtování hotovosti) ===
  const summaryRow =
    (input.issuedInvoices.length > 0 ? trzbyDataEnd : trzbySumRow) + 3;
  sheet.getCell(`A${summaryRow}`).value = "Vyúčtování hotovosti:";
  sheet.getCell(`A${summaryRow}`).font = fontBold;

  sheet.getCell(`C${summaryRow}`).value = "Náklady s DPH:";
  sheet.getCell(`C${summaryRow}`).font = fontBold;
  sheet.getCell(`D${summaryRow}`).value =
    input.receivedInvoices.length > 0
      ? { formula: `E${nakladySumRow}` }
      : 0;
  sheet.getCell(`D${summaryRow}`).numFmt = "#,##0.00";

  sheet.getCell(`F${summaryRow}`).value = "Tržby s DPH:";
  sheet.getCell(`F${summaryRow}`).font = fontBold;
  sheet.getCell(`G${summaryRow}`).value =
    input.issuedInvoices.length > 0 ? { formula: `B${trzbySumRow}` } : 0;
  sheet.getCell(`G${summaryRow}`).numFmt = "#,##0.00";

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

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
