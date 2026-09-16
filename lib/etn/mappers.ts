// Pure mappery DB řádek → ETN model. Bez "use client", bez React, bez Supabase.
// Sdílené mezi preview / export / regenerate, ať je logika efektivního data a
// výpočtu částek z položek na jednom místě.
import type { EtnIssuedInvoice, EtnReceivedInvoice } from "./generate-xlsx";

// Statusy vydaných faktur, které patří do ETN (invoice_issued + archived).
export const ISSUED_ETN_STATUSES = ["invoice_issued", "archived"] as const;

export function isIssuedEtnStatus(status: string): boolean {
  return (ISSUED_ETN_STATUSES as readonly string[]).includes(status);
}

const round2 = (x: number) => Math.round(x * 100) / 100;

/** Znormalizuj embedded relaci (Supabase vrací objekt nebo pole). */
function embeddedName(rel: unknown): string {
  const v = Array.isArray(rel) ? rel[0] : rel;
  return (v as { name?: string } | null)?.name ?? "";
}

/** Efektivní datum vydané faktury: invoice_issued_at || issued_at (YYYY-MM-DD). */
export function issuedEffectiveDate(row: {
  invoice_issued_at: string | null;
  issued_at: string;
}): string {
  return row.invoice_issued_at || row.issued_at;
}

export interface IssuedRow {
  id: string;
  issued_at: string;
  invoice_issued_at: string | null;
  status: string;
  payment_method: string | null;
  short_description: string | null;
  external_invoice_number: string | null;
  variable_symbol: string | null;
  client?: unknown;
  items?: Array<{
    quantity: number | string;
    unit_price_no_vat: number | string;
    vat_rate: number | string;
  }> | null;
}

export interface ReceivedRow {
  id: string;
  issued_at: string;
  payment_method: string;
  amount_total: number | string;
  amount_no_vat: number | string;
  description: string | null;
  supplier?: unknown;
}

/** Spočítá částky vydané faktury z položek (bez/s DPH). */
export function issuedAmounts(row: IssuedRow): {
  noVat: number;
  withVat: number;
} {
  let noVat = 0;
  let vat = 0;
  for (const it of row.items ?? []) {
    const q = Number(it.quantity);
    const p = Number(it.unit_price_no_vat);
    const vr = Number(it.vat_rate);
    const lineNoVat = q * p;
    noVat += lineNoVat;
    vat += lineNoVat * (vr / 100);
  }
  return { noVat: round2(noVat), withVat: round2(noVat + vat) };
}

export function mapIssuedRow(row: IssuedRow): EtnIssuedInvoice {
  const { noVat, withVat } = issuedAmounts(row);
  return {
    issued_at: new Date(issuedEffectiveDate(row)),
    amount_with_vat: withVat,
    amount_no_vat: noVat,
    payment_method: (row.payment_method ?? "fakturace") as
      | "fakturace"
      | "hotovost"
      | "karta"
      | "QR",
    short_description: row.short_description ?? null,
    client_name: embeddedName(row.client),
    external_invoice_number: row.external_invoice_number ?? null,
    variable_symbol: row.variable_symbol ?? null,
  };
}

export function mapReceivedRow(row: ReceivedRow): EtnReceivedInvoice {
  return {
    doc_number: null,
    issued_at: new Date(row.issued_at),
    supplier_name: embeddedName(row.supplier),
    payment_method: row.payment_method as
      | "faktura"
      | "hotovost"
      | "dodaci_list"
      | "dobirka",
    amount_with_vat: Number(row.amount_total),
    amount_no_vat: Number(row.amount_no_vat),
    description: row.description ?? "",
  };
}
