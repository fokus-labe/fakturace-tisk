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

// === FONT KONSTANTY (Petrův styl — Calibri 9pt) ===
const FONT_NAME = "Calibri";
const FONT_DEFAULT = { name: FONT_NAME, size: 9 } as const;
const FONT_BOLD = { name: FONT_NAME, size: 9, bold: true } as const;
const FONT_TITLE = { name: FONT_NAME, size: 9, bold: true } as const;
const FONT_SECTION = { name: FONT_NAME, size: 9, bold: true } as const;
const FONT_FOOTNOTE = {
  name: FONT_NAME,
  size: 8,
  italic: true,
  color: { argb: "FF7F7F7F" },
} as const;

// === FORMÁTY ===
const FORMAT_KC = '#,##0.00 "Kč"';
const FORMAT_DATE = "d.m.yyyy";

// === BORDER ===
const thinBorder: Partial<ExcelJS.Borders> = {
  top: { style: "thin", color: { argb: "FF000000" } },
  left: { style: "thin", color: { argb: "FF000000" } },
  bottom: { style: "thin", color: { argb: "FF000000" } },
  right: { style: "thin", color: { argb: "FF000000" } },
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

export async function generateEtnXlsx(input: EtnReportInput): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Fokus tisk fakturační systém";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("ETN");

  // === Šířky sloupců (Petrův styl) ===
  sheet.getColumn(1).width = 12; // A — číslo dokladu / Datum
  sheet.getColumn(2).width = 12; // B — datum / tržby s DPH
  sheet.getColumn(3).width = 18; // C — dodavatel / tržby bez DPH
  sheet.getColumn(4).width = 12; // D — platba / hotovost
  sheet.getColumn(5).width = 14; // E — náklady s DPH / karta
  sheet.getColumn(6).width = 14; // F — náklady bez DPH / fakturace
  sheet.getColumn(7).width = 22; // G — popis nákladů / QR
  sheet.getColumn(8).width = 22; // H — popis tržeb

  // === Default font na všech buňkách (přes řádky) ===
  // ExcelJS nepodporuje defaultRowFormat globálně, takže nastavujeme na konkrétních buňkách.

  // ============================================================
  // Řádek 1: TITLE
  // ============================================================
  const title = sheet.getCell("A1");
  title.value = "EVIDENCE VYÚČTOVÁNÍ TRŽEB A NÁKLADŮ PROVOZOVNY:";
  title.font = FONT_TITLE;
  title.alignment = { horizontal: "left", vertical: "middle" };

  // Provozovna napravo
  const provozovna = sheet.getCell("H1");
  provozovna.value = "Fokus tisk";
  provozovna.font = FONT_TITLE;
  provozovna.alignment = { horizontal: "right", vertical: "middle" };

  sheet.getRow(1).height = 14;

  // Období (řádek 2)
  const periodCell = sheet.getCell("A2");
  periodCell.value = `Období: ${formatDate(input.periodStart)} – ${formatDate(
    input.periodEnd,
  )}`;
  periodCell.font = FONT_DEFAULT;
  sheet.getRow(2).height = 12;

  // ============================================================
  // NÁKLADY
  // ============================================================
  // Řádek 3: "NÁKLADY" merged A:G centered
  const nakladyHeaderRow = 3;
  sheet.mergeCells(nakladyHeaderRow, 1, nakladyHeaderRow, 7);
  const nakladyLabel = sheet.getCell(nakladyHeaderRow, 1);
  nakladyLabel.value = "NÁKLADY";
  nakladyLabel.font = FONT_SECTION;
  nakladyLabel.alignment = { horizontal: "center", vertical: "middle" };
  sheet.getRow(nakladyHeaderRow).height = 14;

  // Řádek 4: SLOUPCOVÁ HLAVIČKA (texty)
  const nakladyColsRow = 4;
  const nakladyHeaders = [
    "číslo dokladu\nIS Lupa NET",
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
    cell.font = FONT_BOLD;
    cell.alignment = {
      horizontal: "center",
      vertical: "middle",
      wrapText: true,
    };
    cell.border = thinBorder;
  });
  sheet.getRow(nakladyColsRow).height = 28;

  // Řádek 5: SUMAČNÍ ŘÁDEK v hlavičce (pod E a F)
  const nakladySumRow = 5;
  sheet.getRow(nakladySumRow).height = 14;

  // Data NÁKLADY start
  const nakladyDataStart = nakladySumRow + 1;

  input.receivedInvoices.forEach((inv, idx) => {
    const r = nakladyDataStart + idx;
    const c1 = sheet.getCell(r, 1);
    c1.value = inv.doc_number ?? "";
    c1.font = FONT_DEFAULT;
    c1.alignment = { horizontal: "left", vertical: "middle" };

    const c2 = sheet.getCell(r, 2);
    c2.value = inv.issued_at;
    c2.numFmt = FORMAT_DATE;
    c2.font = FONT_DEFAULT;
    c2.alignment = { horizontal: "left", vertical: "middle" };

    const c3 = sheet.getCell(r, 3);
    c3.value = inv.supplier_name;
    c3.font = FONT_DEFAULT;
    c3.alignment = { horizontal: "left", vertical: "middle", wrapText: true };

    const c4 = sheet.getCell(r, 4);
    c4.value =
      PAYMENT_METHOD_LABELS[inv.payment_method] ?? inv.payment_method;
    c4.font = FONT_DEFAULT;
    c4.alignment = { horizontal: "center", vertical: "middle" };

    const c5 = sheet.getCell(r, 5);
    c5.value = inv.amount_with_vat;
    c5.numFmt = FORMAT_KC;
    c5.font = FONT_DEFAULT;
    c5.alignment = { horizontal: "right", vertical: "middle" };

    const c6 = sheet.getCell(r, 6);
    c6.value = inv.amount_no_vat;
    c6.numFmt = FORMAT_KC;
    c6.font = FONT_DEFAULT;
    c6.alignment = { horizontal: "right", vertical: "middle" };

    const c7 = sheet.getCell(r, 7);
    c7.value = inv.description;
    c7.font = FONT_DEFAULT;
    c7.alignment = { horizontal: "left", vertical: "middle", wrapText: true };

    // Border na všech buňkách v řádku
    for (let c = 1; c <= 7; c++) {
      sheet.getCell(r, c).border = thinBorder;
    }
  });

  const nakladyDataEnd =
    nakladyDataStart + Math.max(input.receivedInvoices.length - 1, 0);

  // Sumační formule do řádku 5 (E a F) — odkazuje na data range
  if (input.receivedInvoices.length > 0) {
    const sumE = sheet.getCell(nakladySumRow, 5);
    sumE.value = {
      formula: `SUM(E${nakladyDataStart}:E${nakladyDataEnd})`,
    };
    sumE.numFmt = FORMAT_KC;
    sumE.font = FONT_BOLD;
    sumE.alignment = { horizontal: "right", vertical: "middle" };

    const sumF = sheet.getCell(nakladySumRow, 6);
    sumF.value = {
      formula: `SUM(F${nakladyDataStart}:F${nakladyDataEnd})`,
    };
    sumF.numFmt = FORMAT_KC;
    sumF.font = FONT_BOLD;
    sumF.alignment = { horizontal: "right", vertical: "middle" };
  } else {
    // Bez dat — nulové sumy
    sheet.getCell(nakladySumRow, 5).value = 0;
    sheet.getCell(nakladySumRow, 5).numFmt = FORMAT_KC;
    sheet.getCell(nakladySumRow, 5).font = FONT_BOLD;
    sheet.getCell(nakladySumRow, 5).alignment = {
      horizontal: "right",
      vertical: "middle",
    };
    sheet.getCell(nakladySumRow, 6).value = 0;
    sheet.getCell(nakladySumRow, 6).numFmt = FORMAT_KC;
    sheet.getCell(nakladySumRow, 6).font = FONT_BOLD;
    sheet.getCell(nakladySumRow, 6).alignment = {
      horizontal: "right",
      vertical: "middle",
    };
  }
  // Border na celý sumační řádek (i prázdné A-D a G)
  applyBorderRange(sheet, nakladySumRow, nakladySumRow, 1, 7);

  // "* zaplacené faktury" pozn. — 1 řádek pod posledními daty
  const footnoteRow =
    (input.receivedInvoices.length > 0 ? nakladyDataEnd : nakladySumRow) + 1;
  const footnote = sheet.getCell(footnoteRow, 1);
  footnote.value = "* zaplacené faktury";
  footnote.font = FONT_FOOTNOTE;
  footnote.alignment = { horizontal: "left", vertical: "middle" };
  sheet.getRow(footnoteRow).height = 12;

  // ============================================================
  // TRŽBY
  // ============================================================
  // 2 řádky mezera, pak label
  const trzbyHeaderRow = footnoteRow + 2;
  sheet.mergeCells(trzbyHeaderRow, 1, trzbyHeaderRow, 8);
  const trzbyLabel = sheet.getCell(trzbyHeaderRow, 1);
  trzbyLabel.value = "TRŽBY";
  trzbyLabel.font = FONT_SECTION;
  trzbyLabel.alignment = { horizontal: "center", vertical: "middle" };
  sheet.getRow(trzbyHeaderRow).height = 14;

  // Hlavička první řádek (A-C jednoduchá, D:G merged, H stručný popis)
  const trzbyColsRow = trzbyHeaderRow + 1;
  const trzbyCol1 = sheet.getCell(trzbyColsRow, 1);
  trzbyCol1.value = "Datum";
  trzbyCol1.font = FONT_BOLD;
  trzbyCol1.alignment = {
    horizontal: "center",
    vertical: "middle",
    wrapText: true,
  };

  const trzbyCol2 = sheet.getCell(trzbyColsRow, 2);
  trzbyCol2.value = "tržby s DPH";
  trzbyCol2.font = FONT_BOLD;
  trzbyCol2.alignment = {
    horizontal: "center",
    vertical: "middle",
    wrapText: true,
  };

  const trzbyCol3 = sheet.getCell(trzbyColsRow, 3);
  trzbyCol3.value = "tržby bez DPH";
  trzbyCol3.font = FONT_BOLD;
  trzbyCol3.alignment = {
    horizontal: "center",
    vertical: "middle",
    wrapText: true,
  };

  // Merged D:G "z toho tržby s DPH"
  sheet.mergeCells(trzbyColsRow, 4, trzbyColsRow, 7);
  const trzbyMerged = sheet.getCell(trzbyColsRow, 4);
  trzbyMerged.value = "z toho tržby s DPH";
  trzbyMerged.font = FONT_BOLD;
  trzbyMerged.alignment = {
    horizontal: "center",
    vertical: "middle",
    wrapText: true,
  };

  const trzbyCol8 = sheet.getCell(trzbyColsRow, 8);
  trzbyCol8.value = "stručný popis tržeb";
  trzbyCol8.font = FONT_BOLD;
  trzbyCol8.alignment = {
    horizontal: "center",
    vertical: "middle",
    wrapText: true,
  };

  applyBorderRange(sheet, trzbyColsRow, trzbyColsRow, 1, 8);
  sheet.getRow(trzbyColsRow).height = 14;

  // Sub-hlavička (D-G podsloupce)
  const trzbySubRow = trzbyColsRow + 1;
  sheet.getCell(trzbySubRow, 4).value = "hotovost";
  sheet.getCell(trzbySubRow, 5).value = "karta";
  sheet.getCell(trzbySubRow, 6).value = "fakturace";
  sheet.getCell(trzbySubRow, 7).value = "QR";
  [4, 5, 6, 7].forEach((c) => {
    const cell = sheet.getCell(trzbySubRow, c);
    cell.font = FONT_BOLD;
    cell.alignment = { horizontal: "center", vertical: "middle" };
  });
  // Také A, B, C, H — prázdné, ale s borderem (pokračování merge z trzbyColsRow A, B, C a H by se mělo aplikovat,
  // ale merge je jen na D:G na trzbyColsRow, takže A/B/C/H na trzbySubRow jsou separátní buňky bez merge.
  // V Petrově šabloně je sub-row prázdný v A/B/C/H, ale s borderem.
  applyBorderRange(sheet, trzbySubRow, trzbySubRow, 1, 8);
  sheet.getRow(trzbySubRow).height = 14;

  // SUMAČNÍ ŘÁDEK TRŽBY
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

    const c1 = sheet.getCell(r, 1);
    c1.value = inv.issued_at;
    c1.numFmt = FORMAT_DATE;
    c1.font = FONT_DEFAULT;
    c1.alignment = { horizontal: "left", vertical: "middle" };

    const c2 = sheet.getCell(r, 2);
    c2.value = inv.amount_with_vat;
    c2.numFmt = FORMAT_KC;
    c2.font = FONT_DEFAULT;
    c2.alignment = { horizontal: "right", vertical: "middle" };

    const c3 = sheet.getCell(r, 3);
    c3.value = inv.amount_no_vat;
    c3.numFmt = FORMAT_KC;
    c3.font = FONT_DEFAULT;
    c3.alignment = { horizontal: "right", vertical: "middle" };

    const targetCol = PAYMENT_COL[inv.payment_method] ?? 6;
    const cT = sheet.getCell(r, targetCol);
    cT.value = inv.amount_with_vat;
    cT.numFmt = FORMAT_KC;
    cT.font = FONT_DEFAULT;
    cT.alignment = { horizontal: "right", vertical: "middle" };

    // Ostatní D-G sloupce, které nejsou target — zůstanou prázdné ale font + alignment
    [4, 5, 6, 7].forEach((c) => {
      if (c === targetCol) return;
      const cell = sheet.getCell(r, c);
      cell.font = FONT_DEFAULT;
      cell.alignment = { horizontal: "right", vertical: "middle" };
    });

    const c8 = sheet.getCell(r, 8);
    c8.value =
      inv.short_description ||
      (inv.external_invoice_number
        ? `FV ${inv.external_invoice_number}`
        : inv.client_name);
    c8.font = FONT_DEFAULT;
    c8.alignment = { horizontal: "left", vertical: "middle", wrapText: true };

    applyBorderRange(sheet, r, r, 1, 8);
  });

  const trzbyDataEnd =
    trzbyDataStart + Math.max(input.issuedInvoices.length - 1, 0);

  // Sumační formule
  if (input.issuedInvoices.length > 0) {
    // B = tržby s DPH celkem, C = tržby bez DPH celkem
    const sumB = sheet.getCell(trzbySumRow, 2);
    sumB.value = {
      formula: `SUM(B${trzbyDataStart}:B${trzbyDataEnd})`,
    };
    sumB.numFmt = FORMAT_KC;
    sumB.font = FONT_BOLD;
    sumB.alignment = { horizontal: "right", vertical: "middle" };

    const sumC = sheet.getCell(trzbySumRow, 3);
    sumC.value = {
      formula: `SUM(C${trzbyDataStart}:C${trzbyDataEnd})`,
    };
    sumC.numFmt = FORMAT_KC;
    sumC.font = FONT_BOLD;
    sumC.alignment = { horizontal: "right", vertical: "middle" };

    // D-G sumy pro každou metodu
    [4, 5, 6, 7].forEach((c) => {
      const letter = colLetter(c);
      const cell = sheet.getCell(trzbySumRow, c);
      cell.value = {
        formula: `SUM(${letter}${trzbyDataStart}:${letter}${trzbyDataEnd})`,
      };
      cell.numFmt = FORMAT_KC;
      cell.font = FONT_BOLD;
      cell.alignment = { horizontal: "right", vertical: "middle" };
    });
  } else {
    // Nulové sumy
    [2, 3, 4, 5, 6, 7].forEach((c) => {
      const cell = sheet.getCell(trzbySumRow, c);
      cell.value = 0;
      cell.numFmt = FORMAT_KC;
      cell.font = FONT_BOLD;
      cell.alignment = { horizontal: "right", vertical: "middle" };
    });
  }
  // Datum sloupec A v sumačním řádku zůstane prázdný, ale font + border
  sheet.getCell(trzbySumRow, 1).font = FONT_BOLD;
  sheet.getCell(trzbySumRow, 8).font = FONT_BOLD;
  applyBorderRange(sheet, trzbySumRow, trzbySumRow, 1, 8);
  sheet.getRow(trzbySumRow).height = 14;

  // ============================================================
  // VYÚČTOVÁNÍ HOTOVOSTI
  // ============================================================
  const vyuctovaniRow =
    (input.issuedInvoices.length > 0 ? trzbyDataEnd : trzbySumRow) + 2;

  const vyuctovaniLabel = sheet.getCell(vyuctovaniRow, 1);
  vyuctovaniLabel.value = "Vyúčtování hotovosti:";
  vyuctovaniLabel.font = FONT_BOLD;
  vyuctovaniLabel.alignment = { horizontal: "left", vertical: "middle" };

  // Náklady s DPH:
  const nakladyLbl = sheet.getCell(vyuctovaniRow, 3);
  nakladyLbl.value = "Náklady s DPH:";
  nakladyLbl.font = FONT_BOLD;
  nakladyLbl.alignment = { horizontal: "left", vertical: "middle" };

  const nakladyVal = sheet.getCell(vyuctovaniRow, 4);
  nakladyVal.value = { formula: `E${nakladySumRow}` };
  nakladyVal.numFmt = FORMAT_KC;
  nakladyVal.font = FONT_BOLD;
  nakladyVal.alignment = { horizontal: "right", vertical: "middle" };
  nakladyVal.border = thinBorder;

  // Tržby s DPH:
  const trzbyLbl = sheet.getCell(vyuctovaniRow, 6);
  trzbyLbl.value = "Tržby s DPH:";
  trzbyLbl.font = FONT_BOLD;
  trzbyLbl.alignment = { horizontal: "left", vertical: "middle" };

  const trzbyVal = sheet.getCell(vyuctovaniRow, 7);
  trzbyVal.value = { formula: `B${trzbySumRow}` };
  trzbyVal.numFmt = FORMAT_KC;
  trzbyVal.font = FONT_BOLD;
  trzbyVal.alignment = { horizontal: "right", vertical: "middle" };
  trzbyVal.border = thinBorder;

  // ============================================================
  // PODPISY
  // ============================================================
  const signRow = vyuctovaniRow + 2;
  const schvalil = sheet.getCell(signRow, 2);
  schvalil.value = "Schválil";
  schvalil.font = FONT_DEFAULT;
  schvalil.alignment = { horizontal: "left", vertical: "middle" };

  const predal = sheet.getCell(signRow, 4);
  predal.value = "Předal";
  predal.font = FONT_DEFAULT;
  predal.alignment = { horizontal: "left", vertical: "middle" };

  const prevzal = sheet.getCell(signRow, 7);
  prevzal.value = "Převzal";
  prevzal.font = FONT_DEFAULT;
  prevzal.alignment = { horizontal: "left", vertical: "middle" };

  // ============================================================
  // ČÍSLO TÝDNE VYÚČTOVÁNÍ + PŘEDPOKLÁDANÉ DATUM VYÚČTOVÁNÍ
  // ============================================================
  const cisloTydneRow = signRow + 2;
  const cisloTydneLbl = sheet.getCell(cisloTydneRow, 1);
  cisloTydneLbl.value = "Číslo týdne vyúčtování:";
  cisloTydneLbl.font = FONT_DEFAULT;
  cisloTydneLbl.alignment = { horizontal: "left", vertical: "middle" };

  sheet.mergeCells(cisloTydneRow, 2, cisloTydneRow, 4);
  applyBorderRange(sheet, cisloTydneRow, cisloTydneRow, 2, 4);

  const datumVyuctovaniRow = cisloTydneRow + 2;
  const datumLbl = sheet.getCell(datumVyuctovaniRow, 1);
  datumLbl.value = "Předpokládané datum vyúčtování:";
  datumLbl.font = FONT_DEFAULT;
  datumLbl.alignment = { horizontal: "left", vertical: "middle" };

  sheet.mergeCells(datumVyuctovaniRow, 2, datumVyuctovaniRow, 4);
  applyBorderRange(
    sheet,
    datumVyuctovaniRow,
    datumVyuctovaniRow,
    2,
    4,
  );

  // ============================================================
  // BORDERS pro data NÁKLADY (pokud existují)
  // ============================================================
  if (input.receivedInvoices.length > 0) {
    applyBorderRange(sheet, nakladyDataStart, nakladyDataEnd, 1, 7);
  }

  // ============================================================
  // FREEZE PANE — title + období + NÁKLADY label + 2 řádky hlavičky + sumační řádek
  // ============================================================
  sheet.views = [{ state: "frozen", xSplit: 0, ySplit: 5 }];

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
