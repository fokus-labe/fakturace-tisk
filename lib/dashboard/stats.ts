import type { SupabaseClient } from "@supabase/supabase-js";

export interface CashflowPoint {
  month: string;
  received_with_vat: number;
  received_no_vat: number;
  issued_with_vat: number;
  issued_no_vat: number;
}

export interface TopEntry {
  name: string;
  total: number;
}

export interface DashboardStats {
  currentMonth: {
    received: { count: number; total_with_vat: number; total_no_vat: number };
    issued: { count: number; total_with_vat: number; total_no_vat: number };
    monthOverMonthReceivedPct: number | null;
    monthOverMonthIssuedPct: number | null;
    netProfitWithVat: number;
    marginPct: number | null;
  };
  pending: {
    unpaidReceived: { count: number; total: number };
    atAccountant: { count: number };
  };
  cashflow12months: CashflowPoint[];
  topSuppliers: TopEntry[];
  topClients: TopEntry[];
}

function startOfMonthISO(date: Date): string {
  const d = new Date(date.getFullYear(), date.getMonth(), 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

function endOfMonthISO(date: Date): string {
  const d = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

function monthKey(iso: string): string {
  return iso.slice(0, 7);
}

function pct(curr: number, prev: number): number | null {
  if (prev === 0) return null;
  return Math.round(((curr - prev) / prev) * 100);
}

const round2 = (x: number) => Math.round(x * 100) / 100;

export async function getDashboardStats(
  supabase: SupabaseClient,
): Promise<DashboardStats> {
  const now = new Date();
  const thisMonthStart = startOfMonthISO(now);
  const thisMonthEnd = endOfMonthISO(now);

  const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthStart = startOfMonthISO(lastMonthDate);
  const lastMonthEnd = endOfMonthISO(lastMonthDate);

  const cashflowStartDate = new Date(now.getFullYear(), now.getMonth() - 11, 1);
  const cashflowStart = startOfMonthISO(cashflowStartDate);

  const yearStart = `${now.getFullYear()}-01-01`;
  const yearEnd = `${now.getFullYear()}-12-31`;

  const [
    { data: received },
    { data: issued },
    { data: pendingReceived },
    { data: pendingAtAccountant },
  ] = await Promise.all([
    supabase
      .from("received_invoices")
      .select(
        "id, issued_at, amount_total, amount_no_vat, status, supplier:suppliers(id, name)",
      )
      .gte("issued_at", cashflowStart)
      .neq("status", "cancelled"),
    supabase
      .from("invoice_requests")
      .select(
        "id, issued_at, invoice_issued_at, status, client:clients(id, name), items:invoice_items(quantity, unit_price_no_vat, vat_rate)",
      )
      .gte("issued_at", cashflowStart)
      .not("status", "in", '("cancelled","draft")'),
    supabase
      .from("received_invoices")
      .select("id, amount_total, status")
      .eq("status", "entered"),
    supabase
      .from("invoice_requests")
      .select("id, status")
      .eq("status", "sent_to_accountant"),
  ]);

  const receivedRows = (received ?? []) as unknown as Array<{
    id: string;
    issued_at: string;
    amount_total: number | string;
    amount_no_vat: number | string;
    status: string;
    supplier: { id: string; name: string } | null;
  }>;

  const issuedRows = (issued ?? []) as unknown as Array<{
    id: string;
    issued_at: string;
    invoice_issued_at: string | null;
    status: string;
    client: { id: string; name: string } | null;
    items: Array<{
      quantity: number | string;
      unit_price_no_vat: number | string;
      vat_rate: number | string;
    }>;
  }>;

  // === Cashflow per month ===
  const months = new Map<string, CashflowPoint>();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    months.set(key, {
      month: key,
      received_with_vat: 0,
      received_no_vat: 0,
      issued_with_vat: 0,
      issued_no_vat: 0,
    });
  }

  for (const r of receivedRows) {
    const key = monthKey(r.issued_at);
    const point = months.get(key);
    if (!point) continue;
    point.received_with_vat += Number(r.amount_total);
    point.received_no_vat += Number(r.amount_no_vat);
  }

  for (const inv of issuedRows) {
    const eff = inv.invoice_issued_at || inv.issued_at;
    const key = monthKey(eff);
    const point = months.get(key);
    if (!point) continue;
    let noVat = 0;
    let vat = 0;
    for (const it of inv.items ?? []) {
      const q = Number(it.quantity);
      const p = Number(it.unit_price_no_vat);
      const vr = Number(it.vat_rate);
      noVat += q * p;
      vat += q * p * (vr / 100);
    }
    point.issued_no_vat += noVat;
    point.issued_with_vat += noVat + vat;
  }

  const cashflow12months: CashflowPoint[] = Array.from(months.values()).map(
    (m) => ({
      month: m.month,
      received_with_vat: round2(m.received_with_vat),
      received_no_vat: round2(m.received_no_vat),
      issued_with_vat: round2(m.issued_with_vat),
      issued_no_vat: round2(m.issued_no_vat),
    }),
  );

  // === Period aggregates ===
  function aggregateReceived(start: string, end: string) {
    let count = 0;
    let total_with_vat = 0;
    let total_no_vat = 0;
    for (const r of receivedRows) {
      if (r.issued_at >= start && r.issued_at <= end) {
        count += 1;
        total_with_vat += Number(r.amount_total);
        total_no_vat += Number(r.amount_no_vat);
      }
    }
    return {
      count,
      total_with_vat: round2(total_with_vat),
      total_no_vat: round2(total_no_vat),
    };
  }

  function aggregateIssued(start: string, end: string) {
    let count = 0;
    let total_with_vat = 0;
    let total_no_vat = 0;
    for (const inv of issuedRows) {
      const eff = inv.invoice_issued_at || inv.issued_at;
      if (eff < start || eff > end) continue;
      count += 1;
      for (const it of inv.items ?? []) {
        const q = Number(it.quantity);
        const p = Number(it.unit_price_no_vat);
        const vr = Number(it.vat_rate);
        total_no_vat += q * p;
        total_with_vat += q * p * (1 + vr / 100);
      }
    }
    return {
      count,
      total_with_vat: round2(total_with_vat),
      total_no_vat: round2(total_no_vat),
    };
  }

  const currentMonthReceived = aggregateReceived(
    thisMonthStart,
    thisMonthEnd,
  );
  const lastMonthReceived = aggregateReceived(lastMonthStart, lastMonthEnd);
  const currentMonthIssued = aggregateIssued(thisMonthStart, thisMonthEnd);
  const lastMonthIssued = aggregateIssued(lastMonthStart, lastMonthEnd);

  const monthOverMonthReceivedPct = pct(
    currentMonthReceived.total_with_vat,
    lastMonthReceived.total_with_vat,
  );
  const monthOverMonthIssuedPct = pct(
    currentMonthIssued.total_with_vat,
    lastMonthIssued.total_with_vat,
  );

  const netProfitWithVat = round2(
    currentMonthIssued.total_with_vat - currentMonthReceived.total_with_vat,
  );
  const marginPct =
    currentMonthIssued.total_with_vat > 0
      ? Math.round(
          ((currentMonthIssued.total_with_vat -
            currentMonthReceived.total_with_vat) /
            currentMonthIssued.total_with_vat) *
            100,
        )
      : null;

  // === Top dodavatelé / klienti (tento rok) ===
  const supplierTotals = new Map<string, number>();
  for (const r of receivedRows) {
    if (r.issued_at < yearStart || r.issued_at > yearEnd) continue;
    const name = r.supplier?.name ?? "—";
    supplierTotals.set(
      name,
      (supplierTotals.get(name) ?? 0) + Number(r.amount_total),
    );
  }
  const topSuppliers: TopEntry[] = Array.from(supplierTotals.entries())
    .map(([name, total]) => ({ name, total: round2(total) }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  const clientTotals = new Map<string, number>();
  for (const inv of issuedRows) {
    const eff = inv.invoice_issued_at || inv.issued_at;
    if (eff < yearStart || eff > yearEnd) continue;
    const name = inv.client?.name ?? "—";
    let total = 0;
    for (const it of inv.items ?? []) {
      const q = Number(it.quantity);
      const p = Number(it.unit_price_no_vat);
      const vr = Number(it.vat_rate);
      total += q * p * (1 + vr / 100);
    }
    clientTotals.set(name, (clientTotals.get(name) ?? 0) + total);
  }
  const topClients: TopEntry[] = Array.from(clientTotals.entries())
    .map(([name, total]) => ({ name, total: round2(total) }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  // === Pending ===
  const unpaidReceivedTotal = (pendingReceived ?? []).reduce(
    (s, r) => s + Number(r.amount_total),
    0,
  );

  return {
    currentMonth: {
      received: currentMonthReceived,
      issued: currentMonthIssued,
      monthOverMonthReceivedPct,
      monthOverMonthIssuedPct,
      netProfitWithVat,
      marginPct,
    },
    pending: {
      unpaidReceived: {
        count: (pendingReceived ?? []).length,
        total: round2(unpaidReceivedTotal),
      },
      atAccountant: {
        count: (pendingAtAccountant ?? []).length,
      },
    },
    cashflow12months,
    topSuppliers,
    topClients,
  };
}
