// Pure business logika vyúčtování (Shoptet Pay / Zásilkovna).
// Bez "use client", bez React, bez Supabase — volatelné ze serveru i klienta.
//
// Doklad obsahuje zároveň NÁKLAD i TRŽBU:
//   brutto (gross)  − poplatek (fee)  = netto (net)
// Náklad = jen poplatek (fakturovaná částka za služby). Tržba = hrubá částka
// (brutto) se sazbou 21 %. Historická chyba: do tržeb se dostávala částka po
// odečtení poplatku a poplatek zároveň do nákladů → započítaný dvakrát.

export type SettlementProvider = "shoptet_pay" | "zasilkovna";

export const SETTLEMENT_PROVIDERS: SettlementProvider[] = [
  "shoptet_pay",
  "zasilkovna",
];

export const SETTLEMENT_PROVIDER_LABELS: Record<SettlementProvider, string> = {
  shoptet_pay: "Shoptet Pay",
  zasilkovna: "Zásilkovna",
};

// Dodavatel, na kterého se eviduje náklad (poplatek) daného poskytovatele.
export const SETTLEMENT_COST_SUPPLIER: Record<
  SettlementProvider,
  { name: string; ico: string }
> = {
  shoptet_pay: { name: "Shoptet a.s.", ico: "28935675" },
  zasilkovna: { name: "Zásilkovna s.r.o.", ico: "28408306" },
};

export const SETTLEMENT_TOLERANCE = 0.01; // jeden haléř na zaokrouhlení

export interface SettlementAmounts {
  gross: number; // brutto — příchozí platby / vybrané dobírky
  fee: number; // poplatek — smluvní poplatky / fakturováno za služby
  net: number; // netto — celkem vyplaceno / bude zasláno
}

const round2 = (x: number) => Math.round(x * 100) / 100;

/** brutto − poplatek − netto (mělo by být 0). */
export function settlementSumDiff(a: SettlementAmounts): number {
  return round2(a.gross - a.fee - a.net);
}

/** Kontrola součtu: brutto − poplatek = netto s tolerancí jednoho haléře. */
export function isSettlementSumOk(a: SettlementAmounts): boolean {
  return Math.abs(settlementSumDiff(a)) <= SETTLEMENT_TOLERANCE;
}

/** Stručný popis obou záznamů: „SP <číslo>" / „ZS <číslo>". */
export function settlementShortDescription(
  provider: SettlementProvider,
  statementNumber: string,
): string {
  const prefix = provider === "shoptet_pay" ? "SP" : "ZS";
  return `${prefix} ${statementNumber}`.trim();
}

export interface DerivedCost {
  supplier: { name: string; ico: string };
  category: "sluzby";
  payment_method: "faktura";
  amount_no_vat: number;
  amount_vat: number;
  amount_total: number;
}

export interface DerivedRevenue {
  amount_no_vat: number; // brutto / 1.21
  vat_rate: 21;
  gross_with_vat: number; // brutto
}

/**
 * Náklad z poplatku. Shoptet Pay: poplatek brány se historicky eviduje BEZ DPH
 * (bez DPH = s DPH). Zásilkovna: fakturovaná částka za služby je vč. DPH 21 %.
 */
export function deriveCost(
  provider: SettlementProvider,
  amounts: SettlementAmounts,
): DerivedCost {
  const fee = round2(amounts.fee);
  if (provider === "shoptet_pay") {
    return {
      supplier: SETTLEMENT_COST_SUPPLIER.shoptet_pay,
      category: "sluzby",
      payment_method: "faktura",
      amount_no_vat: fee,
      amount_vat: 0,
      amount_total: fee,
    };
  }
  const noVat = round2(fee / 1.21);
  return {
    supplier: SETTLEMENT_COST_SUPPLIER.zasilkovna,
    category: "sluzby",
    payment_method: "faktura",
    amount_no_vat: noVat,
    amount_vat: round2(fee - noVat),
    amount_total: fee,
  };
}

/**
 * Tržba z hrubé částky (brutto) se sazbou 21 %. Při nulovém brutto tržba
 * nevzniká vůbec (např. Zásilkovna se samotným zprostředkováním).
 */
export function deriveRevenue(amounts: SettlementAmounts): DerivedRevenue | null {
  const gross = round2(amounts.gross);
  if (gross <= 0) return null;
  return {
    amount_no_vat: round2(gross / 1.21),
    vat_rate: 21,
    gross_with_vat: gross,
  };
}
