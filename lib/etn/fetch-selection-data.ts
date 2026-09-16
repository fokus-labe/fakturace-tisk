import type { SupabaseClient } from "@supabase/supabase-js";
import type { EtnIssuedInvoice, EtnReceivedInvoice } from "./generate-xlsx";
import {
  isIssuedEtnStatus,
  issuedEffectiveDate,
  mapIssuedRow,
  mapReceivedRow,
  type IssuedRow,
  type ReceivedRow,
} from "./mappers";

// Kolik faktur maximálně načíst pro výběr (malý provoz — v praxi řádově desítky).
const CANDIDATE_LIMIT = 2000;

export type EtnGroup = "in_period" | "earlier_unsubmitted";

export interface EtnCandidateRow {
  id: string;
  effective_date: string; // YYYY-MM-DD
  label: string;
  number: string | null;
  amount_with_vat: number;
  amount_no_vat: number;
  payment_method: string;
  group: EtnGroup;
  submitted: boolean;
  export_period: { start: string; end: string } | null;
  has_pdf: boolean; // relevantní jen pro přijaté
}

export interface EtnCandidates {
  issued: EtnCandidateRow[];
  received: EtnCandidateRow[];
}

function embeddedExportPeriod(
  rel: unknown,
): { start: string; end: string } | null {
  const v = Array.isArray(rel) ? rel[0] : rel;
  const e = v as { period_start?: string; period_end?: string } | null;
  if (!e?.period_start || !e?.period_end) return null;
  return { start: e.period_start, end: e.period_end };
}

function embeddedName(rel: unknown): string {
  const v = Array.isArray(rel) ? rel[0] : rel;
  return (v as { name?: string } | null)?.name ?? "";
}

function inRange(iso: string, start: string, end: string): boolean {
  return iso >= start && iso <= end;
}

/**
 * Vrátí kandidáty pro výběr v ETN exportu, rozdělené do dvou skupin:
 *  - "in_period": efektivní datum spadá do [periodStart, periodEnd]
 *  - "earlier_unsubmitted": efektivní datum < periodStart a faktura dosud nikdy
 *    nebyla v žádném exportu (etn_export_id IS NULL)
 * Faktury už odevzdané (submitted) se vrací jen ze skupiny in_period (s odznakem
 * období), UI je defaultně skryje/odškrtne.
 */
export async function fetchEtnCandidates(
  supabase: SupabaseClient,
  venueId: string,
  periodStart: string,
  periodEnd: string,
): Promise<EtnCandidates> {
  const [{ data: issuedRows, error: issuedErr }, { data: receivedRows, error: receivedErr }] =
    await Promise.all([
      supabase
        .from("invoice_requests")
        .select(
          "id, issued_at, invoice_issued_at, status, payment_method, short_description, external_invoice_number, variable_symbol, etn_export_id, client:clients(name), items:invoice_items(quantity, unit_price_no_vat, vat_rate), etn_export:etn_exports(period_start, period_end)",
        )
        .eq("venue_id", venueId)
        .in("status", ["invoice_issued", "archived"])
        .order("issued_at", { ascending: true })
        .limit(CANDIDATE_LIMIT),
      supabase
        .from("received_invoices")
        .select(
          "id, issued_at, payment_method, amount_total, amount_no_vat, description, supplier_invoice_number, pdf_url, etn_export_id, supplier:suppliers(name), etn_export:etn_exports(period_start, period_end)",
        )
        .eq("venue_id", venueId)
        .neq("status", "cancelled")
        .order("issued_at", { ascending: true })
        .limit(CANDIDATE_LIMIT),
    ]);

  if (issuedErr) throw new Error(issuedErr.message);
  if (receivedErr) throw new Error(receivedErr.message);

  const issued: EtnCandidateRow[] = [];
  for (const row of (issuedRows ?? []) as unknown as Array<
    IssuedRow & { etn_export_id: string | null; etn_export?: unknown }
  >) {
    if (!isIssuedEtnStatus(row.status)) continue;
    const eff = issuedEffectiveDate(row);
    const submitted = !!row.etn_export_id;
    const mapped = mapIssuedRow(row);
    const base: Omit<EtnCandidateRow, "group"> = {
      id: row.id,
      effective_date: eff,
      label: embeddedName(row.client) || "—",
      number: row.external_invoice_number ?? row.variable_symbol ?? null,
      amount_with_vat: mapped.amount_with_vat,
      amount_no_vat: mapped.amount_no_vat,
      payment_method: row.payment_method ?? "fakturace",
      submitted,
      export_period: embeddedExportPeriod(row.etn_export),
      has_pdf: false,
    };
    if (inRange(eff, periodStart, periodEnd)) {
      issued.push({ ...base, group: "in_period" });
    } else if (eff < periodStart && !submitted) {
      issued.push({ ...base, group: "earlier_unsubmitted" });
    }
  }

  const received: EtnCandidateRow[] = [];
  for (const row of (receivedRows ?? []) as unknown as Array<
    ReceivedRow & {
      etn_export_id: string | null;
      etn_export?: unknown;
      supplier_invoice_number: string | null;
      pdf_url: string | null;
    }
  >) {
    const eff = row.issued_at;
    const submitted = !!row.etn_export_id;
    const base: Omit<EtnCandidateRow, "group"> = {
      id: row.id,
      effective_date: eff,
      label: embeddedName(row.supplier) || "—",
      number: row.supplier_invoice_number ?? null,
      amount_with_vat: Number(row.amount_total),
      amount_no_vat: Number(row.amount_no_vat),
      payment_method: row.payment_method,
      submitted,
      export_period: embeddedExportPeriod(row.etn_export),
      has_pdf: !!row.pdf_url,
    };
    if (inRange(eff, periodStart, periodEnd)) {
      received.push({ ...base, group: "in_period" });
    } else if (eff < periodStart && !submitted) {
      received.push({ ...base, group: "earlier_unsubmitted" });
    }
  }

  return { issued, received };
}

export interface EtnTotals {
  receivedWithVat: number;
  receivedNoVat: number;
  issuedWithVat: number;
  issuedNoVat: number;
}

export function computeEtnTotals(
  received: EtnReceivedInvoice[],
  issued: EtnIssuedInvoice[],
): EtnTotals {
  return {
    receivedWithVat: received.reduce((s, r) => s + r.amount_with_vat, 0),
    receivedNoVat: received.reduce((s, r) => s + r.amount_no_vat, 0),
    issuedWithVat: issued.reduce((s, r) => s + r.amount_with_vat, 0),
    issuedNoVat: issued.reduce((s, r) => s + r.amount_no_vat, 0),
  };
}

export interface ReceivedRawForZip {
  id: string;
  supplier_name: string;
  supplier_invoice_number: string | null;
  issued_at: string;
  payment_method: string;
  pdf_url: string | null;
}

export interface EtnInvoicesByIds {
  issued: EtnIssuedInvoice[];
  received: EtnReceivedInvoice[];
  receivedRaw: ReceivedRawForZip[];
  foundIssued: number;
  foundReceived: number;
}

const ISSUED_SELECT =
  "id, issued_at, invoice_issued_at, status, payment_method, short_description, external_invoice_number, variable_symbol, client:clients(name), items:invoice_items(quantity, unit_price_no_vat, vat_rate)";
const RECEIVED_SELECT =
  "id, issued_at, payment_method, amount_total, amount_no_vat, description, supplier_invoice_number, pdf_url, supplier:suppliers(name)";

/**
 * Načte a namapuje faktury podle explicitního seznamu id, scoped na provozovnu.
 * XLSX se pak generuje z tohoto seznamu, ne z období. foundIssued/foundReceived
 * slouží k ověření, že všechny id patří do provozovny (počty musí sedět).
 */
export async function fetchEtnInvoicesByIds(
  supabase: SupabaseClient,
  venueId: string,
  issuedIds: string[],
  receivedIds: string[],
): Promise<EtnInvoicesByIds> {
  const issuedPromise = issuedIds.length
    ? supabase
        .from("invoice_requests")
        .select(ISSUED_SELECT)
        .eq("venue_id", venueId)
        .in("id", issuedIds)
        .in("status", ["invoice_issued", "archived"])
        .order("issued_at", { ascending: true })
    : null;
  const receivedPromise = receivedIds.length
    ? supabase
        .from("received_invoices")
        .select(RECEIVED_SELECT)
        .eq("venue_id", venueId)
        .in("id", receivedIds)
        .neq("status", "cancelled")
        .order("issued_at", { ascending: true })
    : null;

  const [issuedRes, receivedRes] = await Promise.all([
    issuedPromise,
    receivedPromise,
  ]);

  if (issuedRes?.error) throw new Error(issuedRes.error.message);
  if (receivedRes?.error) throw new Error(receivedRes.error.message);

  const issuedData = (issuedRes?.data ?? []) as unknown as IssuedRow[];
  const receivedData = (receivedRes?.data ?? []) as unknown as Array<
    ReceivedRow & {
      supplier_invoice_number: string | null;
      pdf_url: string | null;
    }
  >;

  return {
    issued: issuedData.map(mapIssuedRow),
    received: receivedData.map(mapReceivedRow),
    receivedRaw: receivedData.map((r) => ({
      id: r.id,
      supplier_name:
        (Array.isArray(r.supplier) ? r.supplier[0] : r.supplier)?.name ?? "",
      supplier_invoice_number: r.supplier_invoice_number ?? null,
      issued_at: r.issued_at,
      payment_method: r.payment_method,
      pdf_url: r.pdf_url ?? null,
    })),
    foundIssued: issuedData.length,
    foundReceived: receivedData.length,
  };
}

/** Načte faktury navázané na daný export (regenerate staví z vazeb, ne z období). */
export async function fetchEtnInvoicesByExportId(
  supabase: SupabaseClient,
  venueId: string,
  exportId: string,
): Promise<{ issued: EtnIssuedInvoice[]; received: EtnReceivedInvoice[] }> {
  const [issuedRes, receivedRes] = await Promise.all([
    supabase
      .from("invoice_requests")
      .select(ISSUED_SELECT)
      .eq("venue_id", venueId)
      .eq("etn_export_id", exportId)
      .in("status", ["invoice_issued", "archived"])
      .order("issued_at", { ascending: true }),
    supabase
      .from("received_invoices")
      .select(RECEIVED_SELECT)
      .eq("venue_id", venueId)
      .eq("etn_export_id", exportId)
      .neq("status", "cancelled")
      .order("issued_at", { ascending: true }),
  ]);

  if (issuedRes.error) throw new Error(issuedRes.error.message);
  if (receivedRes.error) throw new Error(receivedRes.error.message);

  return {
    issued: (issuedRes.data ?? []).map((r) => mapIssuedRow(r as IssuedRow)),
    received: (receivedRes.data ?? []).map((r) =>
      mapReceivedRow(r as ReceivedRow),
    ),
  };
}
