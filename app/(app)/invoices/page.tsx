import Link from "next/link";
import { Plus } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
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
import { InvoiceFilters } from "./invoice-filters";
import {
  presetToRange,
  type DatePreset,
} from "@/components/ui/date-range-filter";
import type { InvoiceStatus } from "@/types/invoice";

interface PageProps {
  searchParams: Promise<{
    status?: string;
    q?: string;
    show_archived?: string;
    preset?: string;
    from?: string;
    to?: string;
  }>;
}

const DATE_PRESETS: DatePreset[] = [
  "all",
  "this_month",
  "last_month",
  "this_year",
  "last_year",
  "custom",
];

const STATUSES: InvoiceStatus[] = [
  "draft",
  "sent_to_accountant",
  "invoice_issued",
  "archived",
  "cancelled",
];

export default async function InvoicesPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const status = sp.status && (STATUSES as string[]).includes(sp.status)
    ? (sp.status as InvoiceStatus)
    : undefined;
  const q = sp.q?.trim().toLowerCase();
  const showArchived = sp.show_archived === "1";

  const preset: DatePreset =
    sp.preset && (DATE_PRESETS as string[]).includes(sp.preset)
      ? (sp.preset as DatePreset)
      : "this_year";
  const presetRange = preset === "custom" ? null : presetToRange(preset);
  const from = presetRange ? presetRange.from : (sp.from ?? "");
  const to = presetRange ? presetRange.to : (sp.to ?? "");

  const supabase = await createClient();
  let query = supabase
    .from("invoice_requests")
    .select("*, client:clients(name), items:invoice_items(quantity, unit_price_no_vat, vat_rate)")
    .order("issued_at", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(200);
  if (status) query = query.eq("status", status);
  else if (!showArchived) query = query.neq("status", "archived");
  if (from) query = query.gte("issued_at", from);
  if (to) query = query.lte("issued_at", to);
  const { data } = await query;
  let invoices = data ?? [];
  if (q) {
    invoices = invoices.filter((inv) =>
      (inv.client?.name ?? "").toLowerCase().includes(q),
    );
  }

  const invoicesWithTotals = invoices.map((inv) => {
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
    const showPayment =
      inv.status === "invoice_issued" || inv.status === "archived";
    return { inv, totals, showPayment };
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-2xl font-semibold tracking-tight">
            Vydané faktury
          </h1>
          <p className="text-sm text-muted-foreground">
            Evidence žádostí o vystavení faktury.
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

      <InvoiceFilters
        initialStatus={status}
        initialQ={sp.q ?? ""}
        initialShowArchived={showArchived}
        initialPreset={preset}
        initialFrom={from}
        initialTo={to}
      />

      {invoicesWithTotals.length === 0 ? (
        <Card>
          <CardContent>
            <p className="text-sm text-muted-foreground p-6 text-center">
              Žádné faktury neodpovídají filtru.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Mobile: card list */}
          <div className="md:hidden space-y-2">
            {invoicesWithTotals.map(({ inv, totals }) => (
              <Link
                key={inv.id}
                href={`/invoices/${inv.id}`}
                className="block rounded-lg border bg-card p-4 transition-colors active:bg-muted/30"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">
                      {inv.client?.name ?? "—"}
                    </p>
                    <p className="text-xs text-muted-foreground font-mono mt-0.5">
                      VS {inv.variable_symbol ?? "—"}
                    </p>
                  </div>
                  <InvoiceStatusBadge status={inv.status} />
                </div>
                <div className="mt-3 flex items-center justify-between text-sm">
                  <span className="text-muted-foreground tabular-nums">
                    {formatDate(inv.issued_at)}
                  </span>
                  <span className="font-mono tabular-nums font-medium">
                    {formatCZK(totals.withVat)}
                  </span>
                </div>
              </Link>
            ))}
          </div>

          {/* Desktop: table */}
          <Card className="hidden md:block">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Klient</TableHead>
                    <TableHead>Datum</TableHead>
                    <TableHead>Splatnost</TableHead>
                    <TableHead>VS</TableHead>
                    <TableHead>Způsob platby</TableHead>
                    <TableHead className="text-right">Částka</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoicesWithTotals.map(({ inv, totals, showPayment }) => (
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
                      <TableCell className="tabular-nums">
                        {formatDate(inv.due_date)}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {inv.variable_symbol ?? "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {showPayment ? inv.payment_method ?? "—" : "—"}
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums">
                        {formatCZK(totals.withVat)}
                      </TableCell>
                      <TableCell>
                        <InvoiceStatusBadge status={inv.status} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
