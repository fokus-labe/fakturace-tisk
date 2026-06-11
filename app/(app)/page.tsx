import Link from "next/link";
import { Plus, TrendingDown, TrendingUp } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { createClient } from "@/lib/supabase/server";
import { getActiveVenue } from "@/lib/venues/get-user-venues";
import { VenueBreadcrumb } from "@/components/venue/venue-breadcrumb";
import { calculateInvoiceTotals } from "@/lib/utils/vat";
import { formatCZK, formatDate } from "@/lib/utils/format";
import { InvoiceStatusBadge } from "@/components/invoice/invoice-status-badge";
import { ReceivedInvoiceStatusBadge } from "@/components/received-invoice/received-invoice-status-badge";
import { CashflowChart } from "@/components/dashboard/cashflow-chart";
import { StatusPill } from "@/components/dashboard/status-pill";
import { getDashboardStats } from "@/lib/dashboard/stats";
import type { InvoiceStatus } from "@/types/invoice";
import type { ReceivedInvoiceStatus } from "@/types/received-invoice";

const ISSUED_PILLS: {
  key: InvoiceStatus;
  label: string;
  tone: "muted" | "amber" | "blue" | "slate" | "red";
}[] = [
  { key: "draft", label: "Koncept", tone: "muted" },
  { key: "sent_to_accountant", label: "U účetní", tone: "amber" },
  { key: "invoice_issued", label: "Vystaveno", tone: "blue" },
  { key: "archived", label: "Archiv", tone: "slate" },
];

const RECEIVED_PILLS: {
  key: ReceivedInvoiceStatus;
  label: string;
  tone: "muted" | "amber" | "emerald" | "slate" | "red";
}[] = [
  { key: "draft", label: "Koncept", tone: "muted" },
  { key: "entered", label: "Zaevidováno", tone: "amber" },
  { key: "paid", label: "Zaplaceno", tone: "emerald" },
  { key: "archived", label: "Archiv", tone: "slate" },
];

export default async function Dashboard() {
  const supabase = await createClient();
  const venue = await getActiveVenue();
  const venueId = venue?.id;

  let issuedQuery = supabase
    .from("invoice_requests")
    .select(
      "*, client:clients(name), items:invoice_items(quantity, unit_price_no_vat, vat_rate)",
    )
    .order("created_at", { ascending: false })
    .limit(200);
  if (venueId) issuedQuery = issuedQuery.eq("venue_id", venueId);

  let receivedQuery = supabase
    .from("received_invoices")
    .select("*, supplier:suppliers(name)")
    .order("created_at", { ascending: false })
    .limit(200);
  if (venueId) receivedQuery = receivedQuery.eq("venue_id", venueId);

  const [{ data: issued }, { data: received }, stats] = await Promise.all([
    issuedQuery,
    receivedQuery,
    getDashboardStats(supabase, venueId),
  ]);

  const issuedList = issued ?? [];
  const receivedList = received ?? [];

  const issuedCounts: Record<InvoiceStatus, number> = {
    draft: 0,
    sent_to_accountant: 0,
    invoice_issued: 0,
    archived: 0,
    cancelled: 0,
  };
  for (const inv of issuedList) {
    issuedCounts[inv.status as InvoiceStatus] =
      (issuedCounts[inv.status as InvoiceStatus] ?? 0) + 1;
  }

  const receivedCounts: Record<ReceivedInvoiceStatus, number> = {
    draft: 0,
    entered: 0,
    paid: 0,
    archived: 0,
    cancelled: 0,
  };
  for (const inv of receivedList) {
    receivedCounts[inv.status as ReceivedInvoiceStatus] =
      (receivedCounts[inv.status as ReceivedInvoiceStatus] ?? 0) + 1;
  }

  const recentIssued = issuedList.slice(0, 5);
  const recentReceived = receivedList.slice(0, 5);

  const cm = stats.currentMonth;
  const netPositive = cm.netProfitWithVat >= 0;

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <VenueBreadcrumb />
          <h1 className="text-2xl font-semibold tracking-tight">
            Přehled{venue ? ` — ${venue.name}` : ""}
          </h1>
          <p className="text-sm text-muted-foreground">
            Fakturace pro provozovnu {venue?.name ?? "Fokus tisk"}.
          </p>
        </div>
        <Link
          href="/invoices/new"
          className={cn(buttonVariants(), "w-full sm:w-auto")}
        >
          <Plus className="size-4 mr-2" />
          Nová faktura
        </Link>
      </div>

      <section>
        <h2 className="mb-3 text-xs font-medium uppercase tracking-widest text-muted-foreground">
          Tento měsíc
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          <div className="rounded-lg border bg-card p-6">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-muted-foreground">
                Příjmy (vystavené)
              </p>
              <TrendingUp className="size-4 text-emerald-600" />
            </div>
            <div className="mt-2">
              <p className="text-3xl font-bold font-mono tabular-nums">
                {formatCZK(cm.issued.total_with_vat)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                z {cm.issued.count} faktur
                {cm.monthOverMonthIssuedPct !== null ? (
                  <span
                    className={cn(
                      "ml-2 tabular-nums",
                      cm.monthOverMonthIssuedPct >= 0
                        ? "text-emerald-600"
                        : "text-red-600",
                    )}
                  >
                    {cm.monthOverMonthIssuedPct >= 0 ? "+" : ""}
                    {cm.monthOverMonthIssuedPct} %
                  </span>
                ) : null}
              </p>
            </div>
          </div>

          <div className="rounded-lg border bg-card p-6">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-muted-foreground">
                Výdaje (přijaté)
              </p>
              <TrendingDown className="size-4 text-red-600" />
            </div>
            <div className="mt-2">
              <p className="text-3xl font-bold font-mono tabular-nums">
                {formatCZK(cm.received.total_with_vat)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                z {cm.received.count} faktur
                {cm.monthOverMonthReceivedPct !== null ? (
                  <span
                    className={cn(
                      "ml-2 tabular-nums",
                      cm.monthOverMonthReceivedPct <= 0
                        ? "text-emerald-600"
                        : "text-red-600",
                    )}
                  >
                    {cm.monthOverMonthReceivedPct >= 0 ? "+" : ""}
                    {cm.monthOverMonthReceivedPct} %
                  </span>
                ) : null}
              </p>
            </div>
          </div>

          <div
            className={cn(
              "rounded-lg border p-6",
              netPositive
                ? "border-emerald-500/40 bg-emerald-50/40"
                : "border-red-500/40 bg-red-50/40",
            )}
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-muted-foreground">
                Čistý zisk
              </p>
            </div>
            <div className="mt-2">
              <p
                className={cn(
                  "text-3xl font-bold font-mono tabular-nums",
                  netPositive ? "text-emerald-700" : "text-red-700",
                )}
              >
                {netPositive ? "+" : ""}
                {formatCZK(cm.netProfitWithVat)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {cm.marginPct === null
                  ? "marže —"
                  : `marže ${cm.marginPct} %`}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="rounded-lg border bg-card p-5">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              K zaplacení
            </p>
            <p className="mt-2 text-xl font-semibold font-mono tabular-nums">
              {formatCZK(stats.pending.unpaidReceived.total)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {stats.pending.unpaidReceived.count} přijatých · status zaevidováno
            </p>
          </div>
          <div className="rounded-lg border bg-card p-5">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Čeká u účetní
            </p>
            <p className="mt-2 text-xl font-semibold tabular-nums">
              {stats.pending.atAccountant.count}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              vydaných faktur čeká na vystavení od Petra
            </p>
          </div>
        </div>
      </section>

      <CashflowChart
        dataWithVat={stats.cashflowWithVat}
        dataNoVat={stats.cashflowNoVat}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-lg border">
          <div className="px-4 py-3 border-b">
            <h3 className="text-sm font-semibold">
              Top dodavatelé ({new Date().getFullYear()})
            </h3>
          </div>
          {stats.topSuppliers.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">
              Žádné záznamy tento rok.
            </p>
          ) : (
            <Table>
              <TableBody>
                {stats.topSuppliers.map((s, i) => (
                  <TableRow key={s.name}>
                    <TableCell className="w-8 text-muted-foreground tabular-nums">
                      {i + 1}.
                    </TableCell>
                    <TableCell>{s.name}</TableCell>
                    <TableCell className="text-right font-mono tabular-nums">
                      {formatCZK(s.total)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        <div className="rounded-lg border">
          <div className="px-4 py-3 border-b">
            <h3 className="text-sm font-semibold">
              Top klienti ({new Date().getFullYear()})
            </h3>
          </div>
          {stats.topClients.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">
              Žádné záznamy tento rok.
            </p>
          ) : (
            <Table>
              <TableBody>
                {stats.topClients.map((c, i) => (
                  <TableRow key={c.name}>
                    <TableCell className="w-8 text-muted-foreground tabular-nums">
                      {i + 1}.
                    </TableCell>
                    <TableCell>{c.name}</TableCell>
                    <TableCell className="text-right font-mono tabular-nums">
                      {formatCZK(c.total)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>

      <section className="space-y-3">
        <h2 className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
          Vydané faktury
        </h2>
        <div className="flex flex-wrap gap-2">
          {ISSUED_PILLS.map((p) => (
            <StatusPill
              key={p.key}
              href={`/invoices?status=${p.key}${p.key === "archived" ? "&show_archived=1" : ""}`}
              label={p.label}
              count={issuedCounts[p.key]}
              tone={p.tone}
            />
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
          Přijaté faktury
        </h2>
        <div className="flex flex-wrap gap-2">
          {RECEIVED_PILLS.map((p) => (
            <StatusPill
              key={p.key}
              href={`/received-invoices?status=${p.key}`}
              label={p.label}
              count={receivedCounts[p.key]}
              tone={p.tone}
            />
          ))}
        </div>
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Posledních 5 vydaných faktur
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recentIssued.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Zatím tu nejsou žádné faktury.{" "}
              <Link className="underline" href="/invoices/new">
                Založit první
              </Link>
              .
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Klient</TableHead>
                  <TableHead>Datum</TableHead>
                  <TableHead>VS</TableHead>
                  <TableHead className="text-right">Částka</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentIssued.map((inv) => {
                  const items = (inv.items ?? []).map(
                    (it: {
                      quantity: number | string;
                      unit_price_no_vat: number | string;
                      vat_rate: number | string;
                    }) => ({
                      quantity: Number(it.quantity),
                      unit_price_no_vat: Number(it.unit_price_no_vat),
                      vat_rate: Number(it.vat_rate),
                    }),
                  );
                  const totals = calculateInvoiceTotals(items);
                  return (
                    <TableRow key={inv.id}>
                      <TableCell>
                        <Link
                          href={`/invoices/${inv.id}`}
                          className="hover:underline"
                        >
                          {inv.client?.name ?? "—"}
                        </Link>
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {formatDate(inv.issued_at)}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {inv.variable_symbol ?? "—"}
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums">
                        {formatCZK(totals.withVat)}
                      </TableCell>
                      <TableCell>
                        <InvoiceStatusBadge status={inv.status} />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Posledních 5 přijatých faktur
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recentReceived.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Zatím tu nejsou žádné přijaté faktury.{" "}
              <Link className="underline" href="/received-invoices/new">
                Založit první
              </Link>
              .
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Dodavatel</TableHead>
                  <TableHead>Datum</TableHead>
                  <TableHead>Popis</TableHead>
                  <TableHead className="text-right">Částka</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentReceived.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell>
                      <Link
                        href={`/received-invoices/${inv.id}`}
                        className="hover:underline"
                      >
                        {inv.supplier?.name ?? "—"}
                      </Link>
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {formatDate(inv.issued_at)}
                    </TableCell>
                    <TableCell className="max-w-xs truncate">
                      {inv.description}
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums">
                      {formatCZK(Number(inv.amount_total))}
                    </TableCell>
                    <TableCell>
                      <ReceivedInvoiceStatusBadge status={inv.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
