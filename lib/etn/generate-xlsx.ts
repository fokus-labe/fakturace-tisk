import ExcelJS from "exceljs";

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
  variable_symbol: string | null;
}

export interface EtnReportInput {
  periodStart: Date;
  periodEnd: Date;
  receivedInvoices: EtnReceivedInvoice[];
  issuedInvoices: EtnIssuedInvoice[];
  /** Název provozovny do hlavičky F1:H1. Default "Fokus tisk". */
  venueName?: string;
}

// Labels pro lidskou čitelnost sloupce D u nákladů.
// POZOR: hotovost MUSÍ zůstat literál "hotovost" kvůli SUMIF na řádku 60.
const PAYMENT_METHOD_LABELS: Record<string, string> = {
  faktura: "faktura",
  hotovost: "hotovost",
  dodaci_list: "dodací list",
  dobirka: "dobírka",
};

// === FONT KONSTANTY (Petrův exaktní styl) ===
const FONT_NAME = "Calibri";
const FONT_TITLE = { name: FONT_NAME, size: 12, bold: true } as const;
const FONT_HEADER = { name: FONT_NAME, size: 10, bold: true } as const;
const FONT_SUM = { name: FONT_NAME, size: 10, bold: true } as const;
const FONT_DATA = { name: FONT_NAME, size: 9 } as const;
const FONT_LABEL = { name: FONT_NAME, size: 10, bold: true } as const;
const FONT_SIGN = { name: FONT_NAME, size: 9 } as const;
const FONT_FOOTER = { name: FONT_NAME, size: 9, bold: true } as const;
const FONT_FOOTNOTE = { name: FONT_NAME, size: 10 } as const;

// === FORMÁTY (Petrův styl s backslash mezerou před "Kč") ===
const FORMAT_KC = '###,##0.00\\ "Kč"';
const FORMAT_KC_VYUCT = '#,##0.00 "Kč"';
const FORMAT_DATE = "d.m.yyyy";

// === FIXNÍ ROZSAHY ===
// NÁKLADY: řádky 6-41 (36 míst), TRŽBY: řádky 47-58 (12 míst)
const NAKLADY_DATA_START = 6;
const NAKLADY_DATA_END = 41;
const NAKLADY_MAX = NAKLADY_DATA_END - NAKLADY_DATA_START + 1;
const TRZBY_DATA_START = 47;
const TRZBY_DATA_END = 58;
const TRZBY_MAX = TRZBY_DATA_END - TRZBY_DATA_START + 1;

const thinBorder: Partial<ExcelJS.Borders> = {
  top: { style: "thin", color: { argb: "FF000000" } },
  left: { style: "thin", color: { argb: "FF000000" } },
  bottom: { style: "thin", color: { argb: "FF000000" } },
  right: { style: "thin", color: { argb: "FF000000" } },
};

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

export async function generateEtnXlsx(
  input: EtnReportInput,
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Fokus tisk fakturační systém";
  workbook.created = new Date();
  const sheet = workbook.addWorksheet("ETN");

  // === Šířky sloupců (po review Petrova vzoru) ===
  sheet.getColumn(1).width = 12; // A — číslo dokladu IS Lupa NET
  sheet.getColumn(2).width = 12; // B — datum
  sheet.getColumn(3).width = 20; // C — dodavatel
  sheet.getColumn(4).width = 12; // D — platba
  sheet.getColumn(5).width = 14; // E — náklady s DPH
  sheet.getColumn(6).width = 14; // F — náklady bez DPH
  sheet.getColumn(7).width = 25; // G — stručný popis nákladů
  sheet.getColumn(8).width = 15; // H

  // === Výšky řádků ===
  sheet.getRow(1).height = 15;
  sheet.getRow(3).height = 18;
  sheet.getRow(4).height = 28;
  sheet.getRow(5).height = 14;
  sheet.getRow(43).height = 18;
  sheet.getRow(44).height = 14;
  sheet.getRow(45).height = 14;
  sheet.getRow(46).height = 14;
  sheet.getRow(60).height = 14;
  sheet.getRow(64).height = 14;
  sheet.getRow(66).height = 14;

  // ============================================================
  // ŘÁDEK 1 — TITLE
  // ============================================================
  sheet.mergeCells("A1:E1");
  const title = sheet.getCell("A1");
  title.value = "EVIDENCE VYÚČTOVÁNÍ TRŽEB A NÁKLADŮ PROVOZOVNY:";
  title.font = FONT_TITLE;
  title.alignment = { horizontal: "left", vertical: "middle" };

  sheet.mergeCells("F1:H1");
  const provozovna = sheet.getCell("F1");
  provozovna.value = input.venueName ?? "Fokus tisk";
  provozovna.font = FONT_TITLE;
  provozovna.alignment = { horizontal: "center", vertical: "middle" };

  // ============================================================
  // ŘÁDEK 3 — "NÁKLADY"
  // ============================================================
  sheet.mergeCells("A3:G3");
  const nakladyLabel = sheet.getCell("A3");
  nakladyLabel.value = "NÁKLADY";
  nakladyLabel.font = FONT_TITLE;
  nakladyLabel.alignment = { horizontal: "center", vertical: "middle" };

  // ============================================================
  // ŘÁDKY 4-5 — SLOUPCOVÉ HLAVIČKY NÁKLADŮ (2-row merged)
  // ============================================================
  sheet.mergeCells("A4:A5");
  sheet.mergeCells("B4:B5");
  sheet.mergeCells("C4:C5");
  sheet.mergeCells("D4:D5");
  sheet.mergeCells("G4:H5");

  const headerMeta: Array<[string, string]> = [
    ["A4", "číslo dokladu\nIS Lupa NET"],
    ["B4", "datum"],
    ["C4", "dodavatel"],
    ["D4", "platba"],
    ["E4", "náklady\ns DPH"],
    ["F4", "náklady\nbez DPH"],
    ["G4", "stručný popis\nnákladů"],
  ];
  for (const [addr, val] of headerMeta) {
    const cell = sheet.getCell(addr);
    cell.value = val;
    cell.font = FONT_HEADER;
    cell.alignment = {
      horizontal: "center",
      vertical: "middle",
      wrapText: true,
    };
  }

  // Sumační formuly v E5 / F5 (zůstávají i při 0 datech — SUM přes prázdno = 0)
  const sumE5 = sheet.getCell("E5");
  sumE5.value = {
    formula: `SUM(E${NAKLADY_DATA_START}:E${NAKLADY_DATA_END})`,
  };
  sumE5.font = FONT_SUM;
  sumE5.numFmt = FORMAT_KC;
  sumE5.alignment = { horizontal: "right", vertical: "middle" };

  const sumF5 = sheet.getCell("F5");
  sumF5.value = {
    formula: `SUM(F${NAKLADY_DATA_START}:F${NAKLADY_DATA_END})`,
  };
  sumF5.font = FONT_SUM;
  sumF5.numFmt = FORMAT_KC;
  sumF5.alignment = { horizontal: "right", vertical: "middle" };

  applyBorderRange(sheet, 4, 5, 1, 8);

  // ============================================================
  // ŘÁDKY 6-41 — DATA NÁKLADŮ (fixní 36-row band)
  // ============================================================
  const receivedSlice = input.receivedInvoices.slice(0, NAKLADY_MAX);

  receivedSlice.forEach((inv, idx) => {
    const r = NAKLADY_DATA_START + idx;

    const cA = sheet.getCell(r, 1);
    cA.value = inv.doc_number ?? "";
    cA.font = FONT_DATA;
    cA.alignment = { horizontal: "left", vertical: "middle" };

    const cB = sheet.getCell(r, 2);
    cB.value = inv.issued_at;
    cB.numFmt = FORMAT_DATE;
    cB.font = FONT_DATA;
    cB.alignment = { horizontal: "left", vertical: "middle" };

    const cC = sheet.getCell(r, 3);
    cC.value = inv.supplier_name;
    cC.font = FONT_DATA;
    cC.alignment = { horizontal: "left", vertical: "middle", wrapText: true };

    const cD = sheet.getCell(r, 4);
    // Kritické: "hotovost" musí zůstat literál pro SUMIF.
    cD.value =
      PAYMENT_METHOD_LABELS[inv.payment_method] ?? inv.payment_method;
    cD.font = FONT_DATA;
    cD.alignment = { horizontal: "center", vertical: "middle" };

    const cE = sheet.getCell(r, 5);
    cE.value = inv.amount_with_vat;
    cE.numFmt = FORMAT_KC;
    cE.font = FONT_DATA;
    cE.alignment = { horizontal: "right", vertical: "middle" };

    const cF = sheet.getCell(r, 6);
    cF.value = inv.amount_no_vat;
    cF.numFmt = FORMAT_KC;
    cF.font = FONT_DATA;
    cF.alignment = { horizontal: "right", vertical: "middle" };

    const cG = sheet.getCell(r, 7);
    cG.value = inv.description;
    cG.font = FONT_DATA;
    cG.alignment = { horizontal: "left", vertical: "middle", wrapText: true };
  });

  // Prázdné řádky 6+N…41 — border, FONT_DATA, FORMAT_KC pro E/F (rezerva)
  for (
    let r = NAKLADY_DATA_START + receivedSlice.length;
    r <= NAKLADY_DATA_END;
    r++
  ) {
    sheet.getCell(r, 5).numFmt = FORMAT_KC;
    sheet.getCell(r, 6).numFmt = FORMAT_KC;
    for (let c = 1; c <= 8; c++) {
      sheet.getCell(r, c).font = FONT_DATA;
    }
  }
  applyBorderRange(sheet, NAKLADY_DATA_START, NAKLADY_DATA_END, 1, 8);

  // ============================================================
  // ŘÁDEK 42 — "* zaplacené faktury"
  // ============================================================
  const footnote = sheet.getCell("A42");
  footnote.value = "* zaplacené faktury";
  footnote.font = FONT_FOOTNOTE;
  footnote.alignment = { horizontal: "left", vertical: "middle" };

  // ============================================================
  // ŘÁDEK 43 — "TRŽBY"
  // ============================================================
  sheet.mergeCells("A43:G43");
  const trzbyLabel = sheet.getCell("A43");
  trzbyLabel.value = "TRŽBY";
  trzbyLabel.font = FONT_TITLE;
  trzbyLabel.alignment = { horizontal: "center", vertical: "middle" };

  // ============================================================
  // ŘÁDKY 44-46 — SLOUPCOVÉ HLAVIČKY TRŽEB (3-row struktura)
  // ============================================================
  sheet.mergeCells("A44:A46");
  sheet.mergeCells("B44:B45");
  sheet.mergeCells("C44:C45");
  sheet.mergeCells("D44:G44");
  sheet.mergeCells("H44:H46");

  const trzbyHeaders: Array<[string, string]> = [
    ["A44", "Datum"],
    ["B44", "tržby\ns DPH"],
    ["C44", "tržby\nbez DPH"],
    ["D44", "z toho tržby s DPH"],
    ["H44", "stručný popis\ntržeb"],
  ];
  for (const [addr, val] of trzbyHeaders) {
    const cell = sheet.getCell(addr);
    cell.value = val;
    cell.font = FONT_HEADER;
    cell.alignment = {
      horizontal: "center",
      vertical: "middle",
      wrapText: true,
    };
  }

  // Sub-hlavička (řádek 45): D-G
  const subHeaders: Array<[string, string]> = [
    ["D45", "hotovost"],
    ["E45", "karta"],
    ["F45", "fakturace"],
    ["G45", "QR "], // Petr má mezeru na konci — záměrně
  ];
  for (const [addr, val] of subHeaders) {
    const cell = sheet.getCell(addr);
    cell.value = val;
    cell.font = FONT_HEADER;
    cell.alignment = { horizontal: "center", vertical: "middle" };
  }

  // Sumační řádek 46: B-G = SUM(X47:X58)
  for (let c = 2; c <= 7; c++) {
    const colLetter = String.fromCharCode(64 + c); // 2->B, 3->C, ...
    const cell = sheet.getCell(46, c);
    cell.value = {
      formula: `SUM(${colLetter}${TRZBY_DATA_START}:${colLetter}${TRZBY_DATA_END})`,
    };
    cell.font = FONT_SUM;
    cell.numFmt = FORMAT_KC;
    cell.alignment = { horizontal: "right", vertical: "middle" };
  }

  applyBorderRange(sheet, 44, 46, 1, 8);

  // ============================================================
  // ŘÁDKY 47-58 — DATA TRŽEB (fixní 12-row band)
  // ============================================================
  const issuedSlice = input.issuedInvoices.slice(0, TRZBY_MAX);

  // Pomocná funkce na D-formuli (auto-dopočet hotovosti)
  const dFormulaFor = (r: number) =>
    `IF(B${r}-E${r}-F${r}-G${r}=0,0,B${r}-E${r}-F${r}-G${r})`;

  // FA prefix helper
  const faLabel = (inv: EtnIssuedInvoice): string => {
    const num = inv.external_invoice_number ?? inv.variable_symbol;
    if (num) return `FA ${num}`;
    return inv.client_name;
  };

  issuedSlice.forEach((inv, idx) => {
    const r = TRZBY_DATA_START + idx;

    const cA = sheet.getCell(r, 1);
    cA.value = inv.issued_at;
    cA.numFmt = FORMAT_DATE;
    cA.font = FONT_DATA;
    cA.alignment = { horizontal: "left", vertical: "middle" };

    const cB = sheet.getCell(r, 2);
    cB.value = inv.amount_with_vat;
    cB.numFmt = FORMAT_KC;
    cB.font = FONT_DATA;
    cB.alignment = { horizontal: "right", vertical: "middle" };

    const cC = sheet.getCell(r, 3);
    cC.value = inv.amount_no_vat;
    cC.numFmt = FORMAT_KC;
    cC.font = FONT_DATA;
    cC.alignment = { horizontal: "right", vertical: "middle" };

    // D — vždy IF formula, dopočítá hotovostní reziduum
    const cD = sheet.getCell(r, 4);
    cD.value = { formula: dFormulaFor(r) };
    cD.numFmt = FORMAT_KC;
    cD.font = FONT_DATA;
    cD.alignment = { horizontal: "right", vertical: "middle" };

    // Podle payment_method vyplň E/F/G; hotovost se NEPÍŠE
    let targetCol: number | null = null;
    if (inv.payment_method === "karta") targetCol = 5;
    else if (inv.payment_method === "fakturace") targetCol = 6;
    else if (inv.payment_method === "QR") targetCol = 7;

    if (targetCol !== null) {
      const cT = sheet.getCell(r, targetCol);
      cT.value = inv.amount_with_vat;
      cT.numFmt = FORMAT_KC;
      cT.font = FONT_DATA;
      cT.alignment = { horizontal: "right", vertical: "middle" };
    }

    // Ostatní E/F/G — font + alignment + numFmt (kvůli vizuálnímu sladění)
    for (const c of [5, 6, 7]) {
      if (c === targetCol) continue;
      const cell = sheet.getCell(r, c);
      cell.font = FONT_DATA;
      cell.numFmt = FORMAT_KC;
      cell.alignment = { horizontal: "right", vertical: "middle" };
    }

    const cH = sheet.getCell(r, 8);
    cH.value = faLabel(inv);
    cH.font = FONT_DATA;
    cH.alignment = { horizontal: "left", vertical: "middle", wrapText: true };
  });

  // Prázdné řádky tržeb — i tak vyplnit D formulí (Petr ručně doplní data)
  for (
    let r = TRZBY_DATA_START + issuedSlice.length;
    r <= TRZBY_DATA_END;
    r++
  ) {
    sheet.getCell(r, 1).numFmt = FORMAT_DATE;
    for (let c = 2; c <= 7; c++) {
      sheet.getCell(r, c).numFmt = FORMAT_KC;
    }
    for (let c = 1; c <= 8; c++) {
      sheet.getCell(r, c).font = FONT_DATA;
    }
    const cD = sheet.getCell(r, 4);
    cD.value = { formula: dFormulaFor(r) };
    cD.alignment = { horizontal: "right", vertical: "middle" };
  }
  applyBorderRange(sheet, TRZBY_DATA_START, TRZBY_DATA_END, 1, 8);

  // ============================================================
  // ŘÁDEK 60 — VYÚČTOVÁNÍ HOTOVOSTI
  // ============================================================
  const vyuctLabel = sheet.getCell("A60");
  vyuctLabel.value = "Vyúčtování hotovosti:";
  vyuctLabel.font = FONT_LABEL;
  vyuctLabel.alignment = { horizontal: "left", vertical: "middle" };

  const nakladyLbl = sheet.getCell("C60");
  nakladyLbl.value = "Náklady s DPH:";
  nakladyLbl.font = FONT_LABEL;
  nakladyLbl.alignment = { horizontal: "left", vertical: "middle" };

  const nakladyVal = sheet.getCell("D60");
  nakladyVal.value = {
    formula: `SUMIF(D${NAKLADY_DATA_START}:D${NAKLADY_DATA_END},"hotovost",E${NAKLADY_DATA_START}:E${NAKLADY_DATA_END})`,
  };
  nakladyVal.font = FONT_LABEL;
  nakladyVal.numFmt = FORMAT_KC_VYUCT;
  nakladyVal.alignment = { horizontal: "right", vertical: "middle" };

  const trzbyLbl = sheet.getCell("G60");
  trzbyLbl.value = "Tržby s DPH:";
  trzbyLbl.font = FONT_LABEL;
  trzbyLbl.alignment = { horizontal: "left", vertical: "middle" };

  const trzbyVal = sheet.getCell("H60");
  trzbyVal.value = {
    formula: `ROUNDUP(SUM(D${TRZBY_DATA_START}:D${TRZBY_DATA_END}),0)`,
  };
  trzbyVal.font = FONT_LABEL;
  trzbyVal.numFmt = FORMAT_KC;
  trzbyVal.alignment = { horizontal: "right", vertical: "middle" };

  // ============================================================
  // ŘÁDEK 64 — PODPISY
  // ============================================================
  sheet.mergeCells("A64:B64");
  const schvalil = sheet.getCell("A64");
  schvalil.value = "Schválil";
  schvalil.font = FONT_SIGN;
  schvalil.alignment = { horizontal: "center", vertical: "middle" };

  sheet.mergeCells("D64:E64");
  const predal = sheet.getCell("D64");
  predal.value = "Předal";
  predal.font = FONT_SIGN;
  predal.alignment = { horizontal: "center", vertical: "middle" };

  sheet.mergeCells("G64:H64");
  const prevzal = sheet.getCell("G64");
  prevzal.value = "Převzal";
  prevzal.font = FONT_SIGN;
  prevzal.alignment = { horizontal: "center", vertical: "middle" };

  // ============================================================
  // ŘÁDEK 66 — ČÍSLO TÝDNE + PŘEDPOKLÁDANÉ DATUM
  // ============================================================
  const cisloTydneLbl = sheet.getCell("A66");
  cisloTydneLbl.value = "Číslo týdne vyúčtování:";
  cisloTydneLbl.font = FONT_FOOTER;
  cisloTydneLbl.alignment = { horizontal: "left", vertical: "middle" };

  sheet.mergeCells("E66:G66");
  const datumLbl = sheet.getCell("E66");
  datumLbl.value = "Předpokládané datum vyúčtování:";
  datumLbl.font = FONT_FOOTER;
  datumLbl.alignment = { horizontal: "left", vertical: "middle" };

  // ============================================================
  // FREEZE PANE — zamrazí title + NÁKLADY + headers + sum row 5
  // ============================================================
  sheet.views = [{ state: "frozen", xSplit: 0, ySplit: 5 }];

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
