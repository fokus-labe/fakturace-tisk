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
import type { InvoiceStatus } from "@/types/invoice";

interface PageProps {
  searchParams: Promise<{ status?: string; q?: string; show_archived?: string }>;
}

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

  const supabase = await createClient();
  let query = supabase
    .from("invoice_requests")
    .select("*, client:clients(name), items:invoice_items(quantity, unit_price_no_vat, vat_rate)")
    .order("created_at", { ascending: false })
    .limit(200);
  if (status) query = query.eq("status", status);
  else if (!showArchived) query = query.neq("status", "archived");
  const { data } = await query;
  let invoices = data ?? [];
  if (q) {
    invoices = invoices.filter((inv) =>
      (inv.client?.name ?? "").toLowerCase().includes(q),
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Vydané faktury
          </h1>
          <p className="text-sm text-muted-foreground">
            Evidence žádostí o vystavení faktury.
          </p>
        </div>
        <Link href="/invoices/new" className={cn(buttonVariants())}>
          <Plus className="size-4 mr-2" />
          Nová faktura
        </Link>
      </div>

      <InvoiceFilters
        initialStatus={status}
        initialQ={sp.q ?? ""}
        initialShowArchived={showArchived}
      />

      <Card>
        <CardContent className="p-0">
          {invoices.length === 0 ? (
            <p className="text-sm text-muted-foreground p-6">
              Žádné faktury neodpovídají filtru.
            </p>
          ) : (
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
                {invoices.map((inv) => {
                  const items = (inv.items ?? []).map((it: { quantity: number | string; unit_price_no_vat: number | string; vat_rate: number | string }) => ({
                    quantity: Number(it.quantity),
                    unit_price_no_vat: Number(it.unit_price_no_vat),
                    vat_rate: Number(it.vat_rate),
                  }));
                  const totals = calculateInvoiceTotals(items);
                  const showPayment =
                    inv.status === "invoice_issued" ||
                    inv.status === "archived";
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
                      <TableCell className="tabular-nums">
                        {formatDate(inv.due_date)}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {inv.variable_symbol ?? "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {showPayment ? inv.payment_method ?? "—" : "—"}
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
    </div>
  );
}
