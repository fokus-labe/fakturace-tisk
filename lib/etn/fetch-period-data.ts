import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  EtnIssuedInvoice,
  EtnReceivedInvoice,
} from "./generate-xlsx";

export interface EtnPeriodData {
  receivedInvoices: EtnReceivedInvoice[];
  issuedInvoices: EtnIssuedInvoice[];
  warnings: EtnWarning[];
}

export interface EtnWarning {
  type:
    | "unpaid_received"
    | "draft_issued"
    | "sent_to_accountant_issued"
    | "row_overflow_received"
    | "row_overflow_issued";
  message: string;
  count: number;
}

// Fixní rozsahy Petrovy šablony — drž sync s lib/etn/generate-xlsx.ts
const ETN_MAX_RECEIVED = 36;
const ETN_MAX_ISSUED = 12;

function inPeriod(
  iso: string | null,
  start: string,
  end: string,
): boolean {
  if (!iso) return false;
  return iso >= start && iso <= end;
}

export async function fetchEtnPeriodData(
  supabase: SupabaseClient,
  periodStart: string,
  periodEnd: string,
  venueId?: string,
): Promise<EtnPeriodData> {
  // === Přijaté faktury v období (kromě cancelled) ===
  let receivedQuery = supabase
    .from("received_invoices")
    .select("*, supplier:suppliers(name)")
    .gte("issued_at", periodStart)
    .lte("issued_at", periodEnd)
    .neq("status", "cancelled")
    .order("issued_at", { ascending: true });
  if (venueId) receivedQuery = receivedQuery.eq("venue_id", venueId);
  const { data: receivedRows, error: errReceived } = await receivedQuery;
  if (errReceived) throw new Error(errReceived.message);

  // === Vydané faktury — bereme všechny krom draft/cancelled za období ===
  // Efektivní datum = invoice_issued_at || issued_at.
  // Pro správné filtrování načteme širší okno a vyfiltrujeme v JS.
  let issuedQuery = supabase
    .from("invoice_requests")
    .select("*, client:clients(name), items:invoice_items(*)")
    .not("status", "in", '("cancelled")')
    .order("issued_at", { ascending: true });
  if (venueId) issuedQuery = issuedQuery.eq("venue_id", venueId);
  const { data: issuedRows, error: errIssued } = await issuedQuery;
  if (errIssued) throw new Error(errIssued.message);

  const allIssued = issuedRows ?? [];

  // === WARNINGS ===
  const unpaidReceivedCount = (receivedRows ?? []).filter(
    (r) => r.status !== "paid" && r.status !== "archived",
  ).length;

  const draftIssuedInPeriod = allIssued.filter((inv) => {
    const eff = inv.invoice_issued_at || inv.issued_at;
    return inv.status === "draft" && inPeriod(eff, periodStart, periodEnd);
  }).length;

  const sentToAccountantInPeriod = allIssued.filter((inv) => {
    const eff = inv.invoice_issued_at || inv.issued_at;
    return (
      inv.status === "sent_to_accountant" &&
      inPeriod(eff, periodStart, periodEnd)
    );
  }).length;

  const warnings: EtnWarning[] = [];
  if (unpaidReceivedCount > 0) {
    warnings.push({
      type: "unpaid_received",
      message: `${unpaidReceivedCount} přijatých faktur není zaplaceno`,
      count: unpaidReceivedCount,
    });
  }
  if (draftIssuedInPeriod > 0) {
    warnings.push({
      type: "draft_issued",
      message: `${draftIssuedInPeriod} vydaných faktur ve statusu draft (nebudou zahrnuty)`,
      count: draftIssuedInPeriod,
    });
  }
  if (sentToAccountantInPeriod > 0) {
    warnings.push({
      type: "sent_to_accountant_issued",
      message: `${sentToAccountantInPeriod} vydaných faktur čeká u účetní (nebudou zahrnuty)`,
      count: sentToAccountantInPeriod,
    });
  }

  // === Mapování ===
  const receivedInvoices: EtnReceivedInvoice[] = (receivedRows ?? []).map(
    (inv) => ({
      doc_number: null,
      issued_at: new Date(inv.issued_at),
      supplier_name: inv.supplier?.name ?? "",
      payment_method: inv.payment_method,
      amount_with_vat: Number(inv.amount_total),
      amount_no_vat: Number(inv.amount_no_vat),
      description: inv.description ?? "",
    }),
  );

  // Do exportu jen ty se statusem invoice_issued nebo archived, v období
  const issuedInvoices: EtnIssuedInvoice[] = allIssued
    .filter((inv) => {
      if (inv.status !== "invoice_issued" && inv.status !== "archived") {
        return false;
      }
      const eff = inv.invoice_issued_at || inv.issued_at;
      return inPeriod(eff, periodStart, periodEnd);
    })
    .map((inv) => {
      const items = (inv.items ?? []) as Array<{
        quantity: number | string;
        unit_price_no_vat: number | string;
        vat_rate: number | string;
      }>;
      let noVat = 0;
      let vat = 0;
      for (const it of items) {
        const q = Number(it.quantity);
        const p = Number(it.unit_price_no_vat);
        const vr = Number(it.vat_rate);
        const lineNoVat = q * p;
        const lineVat = lineNoVat * (vr / 100);
        noVat += lineNoVat;
        vat += lineVat;
      }
      const round2 = (x: number) => Math.round(x * 100) / 100;
      return {
        issued_at: new Date(inv.invoice_issued_at || inv.issued_at),
        amount_with_vat: round2(noVat + vat),
        amount_no_vat: round2(noVat),
        payment_method: (inv.payment_method ?? "fakturace") as
          | "fakturace"
          | "hotovost"
          | "karta"
          | "QR",
        short_description: inv.short_description ?? null,
        client_name: inv.client?.name ?? "",
        external_invoice_number: inv.external_invoice_number ?? null,
        variable_symbol: inv.variable_symbol ?? null,
      };
    });

  if (receivedInvoices.length > ETN_MAX_RECEIVED) {
    warnings.push({
      type: "row_overflow_received",
      message:
        `ETN šablona má místo pro ${ETN_MAX_RECEIVED} nákladů, máš ${receivedInvoices.length}. ` +
        `Vygenerovaný soubor obsahuje jen prvních ${ETN_MAX_RECEIVED} — zúžit období.`,
      count: receivedInvoices.length,
    });
  }
  if (issuedInvoices.length > ETN_MAX_ISSUED) {
    warnings.push({
      type: "row_overflow_issued",
      message:
        `ETN šablona má místo pro ${ETN_MAX_ISSUED} tržeb, máš ${issuedInvoices.length}. ` +
        `Vygenerovaný soubor obsahuje jen prvních ${ETN_MAX_ISSUED} — zúžit období.`,
      count: issuedInvoices.length,
    });
  }

  return { receivedInvoices, issuedInvoices, warnings };
}
