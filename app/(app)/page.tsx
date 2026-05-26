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
import { calculateInvoiceTotals } from "@/lib/utils/vat";
import { formatCZK, formatDate } from "@/lib/utils/format";
import { InvoiceStatusBadge } from "@/components/invoice/invoice-status-badge";
import { ReceivedInvoiceStatusBadge } from "@/components/received-invoice/received-invoice-status-badge";
import { CashflowChart } from "@/components/dashboard/cashflow-chart";
import { getDashboardStats } from "@/lib/dashboard/stats";
import type { InvoiceStatus } from "@/types/invoice";
import type { ReceivedInvoiceStatus } from "@/types/received-invoice";

const ISSUED_STATUS_CARDS: { key: InvoiceStatus; label: string }[] = [
  { key: "draft", label: "Koncept" },
  { key: "sent_to_accountant", label: "U účetní" },
  { key: "invoice_issued", label: "Vystaveno" },
  { key: "archived", label: "Archiv" },
];

const RECEIVED_STATUS_CARDS: { key: ReceivedInvoiceStatus; label: string }[] = [
  { key: "draft", label: "Koncept" },
  { key: "entered", label: "Zaevidované" },
  { key: "paid", label: "Zaplacené" },
  { key: "archived", label: "Archiv" },
];

function MoMBadge({ pct }: { pct: number | null }) {
  if (pct === null) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }
  const positive = pct >= 0;
  const Icon = positive ? TrendingUp : TrendingDown;
  const color = positive ? "text-emerald-600" : "text-red-600";
  return (
    <span className={cn("text-xs flex items-center gap-1", color)}>
      <Icon className="size-3" />
      {positive ? "+" : ""}
      {pct} % proti min. měsíci
    </span>
  );
}

export default async function Dashboard() {
  const supabase = await createClient();

  const [
    { data: issued },
    { data: received },
    stats,
  ] = await Promise.all([
    supabase
      .from("invoice_requests")
      .select(
        "*, client:clients(name), items:invoice_items(quantity, unit_price_no_vat, vat_rate)",
      )
      .order("created_at", { ascending: false })
      .limit(200),
    supabase
      .from("received_invoices")
      .select("*, supplier:suppliers(name)")
      .order("created_at", { ascending: false })
      .limit(200),
    getDashboardStats(supabase),
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

  const netPositive = stats.currentMonth.netProfitWithVat >= 0;

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Přehled</h1>
          <p className="text-sm text-muted-foreground">
            Fakturace pro provozovnu Fokus tisk.
          </p>
        </div>
        <Link href="/invoices/new" className={cn(buttonVariants())}>
          <Plus className="size-4 mr-2" />
          Nová faktura
        </Link>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-medium uppercase tracking-widest text-muted-foreground">
          Tento měsíc
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">
                Příjmy (vystavené)
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-1">
              <div className="text-2xl font-semibold tabular-nums">
                {formatCZK(stats.currentMonth.issued.total_with_vat)}
              </div>
              <div className="text-xs text-muted-foreground">
                z {stats.currentMonth.issued.count} faktur
              </div>
              <MoMBadge pct={stats.currentMonth.monthOverMonthIssuedPct} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">
                Výdaje (přijaté)
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-1">
              <div className="text-2xl font-semibold tabular-nums">
                {formatCZK(stats.currentMonth.received.total_with_vat)}
              </div>
              <div className="text-xs text-muted-foreground">
                z {stats.currentMonth.received.count} faktur
              </div>
              <MoMBadge pct={stats.currentMonth.monthOverMonthReceivedPct} />
            </CardContent>
          </Card>

          <Card
            className={cn(
              netPositive
                ? "border-emerald-500/40 bg-emerald-50/40 dark:bg-emerald-950/20"
                : "border-red-500/40 bg-red-50/40 dark:bg-red-950/20",
            )}
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">
                Čistý zisk
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-1">
              <div
                className={cn(
                  "text-2xl font-semibold tabular-nums",
                  netPositive ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400",
                )}
              >
                {netPositive ? "+" : ""}
                {formatCZK(stats.currentMonth.netProfitWithVat)}
              </div>
              <div className="text-xs text-muted-foreground">
                {stats.currentMonth.marginPct === null
                  ? "marže —"
                  : `marže ${stats.currentMonth.marginPct} %`}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">
                K zaplacení
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-1">
              <div className="text-xl font-semibold tabular-nums">
                {formatCZK(stats.pending.unpaidReceived.total)}
              </div>
              <div className="text-xs text-muted-foreground">
                {stats.pending.unpaidReceived.count} přijatých · status entered
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">
                Čeká u účetní
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-1">
              <div className="text-xl font-semibold tabular-nums">
                {stats.pending.atAccountant.count}
              </div>
              <div className="text-xs text-muted-foreground">
                vydaných faktur čeká na vystavení od Petra
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <CashflowChart data={stats.cashflow12months} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Top 5 dodavatelů ({new Date().getFullYear()})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {stats.topSuppliers.length === 0 ? (
              <p className="text-sm text-muted-foreground p-6">
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
                      <TableCell className="text-right tabular-nums">
                        {formatCZK(s.total)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Top 5 klientů ({new Date().getFullYear()})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {stats.topClients.length === 0 ? (
              <p className="text-sm text-muted-foreground p-6">
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
                      <TableCell className="text-right tabular-nums">
                        {formatCZK(c.total)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-medium uppercase tracking-widest text-muted-foreground">
          Vydané faktury
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {ISSUED_STATUS_CARDS.map((s) => (
            <Card key={s.key}>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">
                  {s.label}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="text-2xl font-semibold tabular-nums">
                  {issuedCounts[s.key]}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium uppercase tracking-widest text-muted-foreground">
          Přijaté faktury
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {RECEIVED_STATUS_CARDS.map((s) => (
            <Card key={s.key}>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">
                  {s.label}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="text-2xl font-semibold tabular-nums">
                  {receivedCounts[s.key]}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Posledních 5 vydaných faktur</CardTitle>
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
                      <TableCell className="text-right tabular-nums">
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
                    <TableCell className="text-right tabular-nums">
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
