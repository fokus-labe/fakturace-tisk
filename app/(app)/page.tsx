import Link from "next/link";
import { Plus } from "lucide-react";
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
import type { InvoiceStatus } from "@/types/invoice";

const STATUS_LABELS: Record<InvoiceStatus, string> = {
  draft: "Koncept",
  sent_to_accountant: "U účetní",
  invoice_issued: "Vystavené",
  paid: "Zaplacené",
  archived: "Archiv",
  cancelled: "Zrušené",
};

export default async function Dashboard() {
  const supabase = await createClient();
  const { data: invoices } = await supabase
    .from("invoice_requests")
    .select("*, client:clients(name), items:invoice_items(quantity, unit_price_no_vat, vat_rate)")
    .order("created_at", { ascending: false })
    .limit(50);

  const list = invoices ?? [];

  const counts: Record<InvoiceStatus, number> = {
    draft: 0,
    sent_to_accountant: 0,
    invoice_issued: 0,
    paid: 0,
    archived: 0,
    cancelled: 0,
  };
  for (const inv of list) {
    counts[inv.status as InvoiceStatus] =
      (counts[inv.status as InvoiceStatus] ?? 0) + 1;
  }

  const recent = list.slice(0, 5);

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

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {(Object.keys(counts) as InvoiceStatus[]).map((s) => (
          <Card key={s}>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">
                {STATUS_LABELS[s]}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-2xl font-semibold">{counts[s]}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Posledních 5 faktur</CardTitle>
        </CardHeader>
        <CardContent>
          {recent.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Zatím tu nejsou žádné faktury. <Link className="underline" href="/invoices/new">Založit první</Link>.
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
                {recent.map((inv) => {
                  const items = (inv.items ?? []).map((it: { quantity: number | string; unit_price_no_vat: number | string; vat_rate: number | string }) => ({
                    quantity: Number(it.quantity),
                    unit_price_no_vat: Number(it.unit_price_no_vat),
                    vat_rate: Number(it.vat_rate),
                  }));
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
                      <TableCell>{formatDate(inv.issued_at)}</TableCell>
                      <TableCell>{inv.variable_symbol ?? "—"}</TableCell>
                      <TableCell className="text-right">
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
