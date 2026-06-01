import { notFound } from "next/navigation";
import { ArrowLeft, Upload } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { InvoiceStatusBadge } from "@/components/invoice/invoice-status-badge";
import { InvoiceStepper } from "@/components/invoice/invoice-stepper";
import { InvoiceActions } from "./invoice-actions";
import { formatCZK, formatDate } from "@/lib/utils/format";
import { calculateInvoiceTotals, calculateLineTotal } from "@/lib/utils/vat";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function InvoiceDetailPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: invoice } = await supabase
    .from("invoice_requests")
    .select("*, client:clients(*), items:invoice_items(*)")
    .eq("id", id)
    .single();
  if (!invoice) notFound();

  const items = (invoice.items ?? [])
    .map((it: { id: string; description: string; quantity: number | string; unit_price_no_vat: number | string; vat_rate: number | string; order_index: number }) => ({
      ...it,
      quantity: Number(it.quantity),
      unit_price_no_vat: Number(it.unit_price_no_vat),
      vat_rate: Number(it.vat_rate),
    }))
    .sort((a: { order_index: number }, b: { order_index: number }) =>
      a.order_index - b.order_index,
    );
  const totals = calculateInvoiceTotals(items);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link
          href="/invoices"
          className="inline-flex items-center hover:text-foreground"
        >
          <ArrowLeft className="size-4 mr-1" />
          Vydané faktury
        </Link>
      </div>

      <div className="space-y-4">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-semibold tracking-tight">
              {invoice.client?.name ?? "—"}
            </h1>
            <InvoiceStatusBadge status={invoice.status} />
          </div>
          <p className="text-sm text-muted-foreground">
            VS {invoice.variable_symbol || "—"} ·{" "}
            {formatDate(invoice.issued_at)}
          </p>
          {invoice.source_metadata?.imported ? (
            <div className="mt-2 inline-flex items-center gap-2 rounded-md bg-muted px-3 py-1.5 text-xs text-muted-foreground">
              <Upload className="size-3.5" />
              <span>Importováno přes OCR</span>
              {invoice.source_metadata.import_date ? (
                <span className="font-mono">
                  {formatDate(invoice.source_metadata.import_date)}
                </span>
              ) : null}
            </div>
          ) : null}
        </div>

        <Card>
          <CardContent className="py-4">
            <InvoiceStepper status={invoice.status} />
          </CardContent>
        </Card>

        <InvoiceActions
          invoiceId={invoice.id}
          status={invoice.status}
          externalInvoiceNumber={invoice.external_invoice_number}
          invoiceIssuedAt={invoice.invoice_issued_at}
          variableSymbol={invoice.variable_symbol}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Odběratel</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-0.5">
            <div className="font-semibold">{invoice.client?.name}</div>
            {invoice.client?.address_street ? (
              <div>{invoice.client.address_street}</div>
            ) : null}
            {invoice.client?.address_city || invoice.client?.address_zip ? (
              <div>
                {invoice.client?.address_zip ?? ""}{" "}
                {invoice.client?.address_city ?? ""}
              </div>
            ) : null}
            {invoice.client?.ico ? (
              <div className="text-muted-foreground">
                IČO:{" "}
                <span className="font-mono text-sm">{invoice.client.ico}</span>
              </div>
            ) : null}
            {invoice.client?.dic ? (
              <div className="text-muted-foreground">
                DIČ:{" "}
                <span className="font-mono text-sm">{invoice.client.dic}</span>
              </div>
            ) : null}
            {invoice.client?.email ? (
              <div className="text-muted-foreground">
                {invoice.client.email}
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Detaily</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-1.5">
            <Row label="Datum vystavení (podklad)" value={formatDate(invoice.issued_at)} />
            {invoice.invoice_issued_at ? (
              <Row
                label="Datum vystavení (účetní)"
                value={formatDate(invoice.invoice_issued_at)}
              />
            ) : null}
            <Row label="Splatnost" value={formatDate(invoice.due_date)} />
            <Row
              label="Variabilní symbol"
              value={invoice.variable_symbol || "—"}
              mono
            />
            <Row label="Způsob platby" value={invoice.payment_method ?? "—"} />
            {invoice.short_description ? (
              <Row label="Krátký popis" value={invoice.short_description} />
            ) : null}
            {invoice.external_invoice_number ? (
              <Row
                label="Číslo faktury (od účetní)"
                value={invoice.external_invoice_number}
                mono
              />
            ) : null}
            {invoice.email_sent_at ? (
              <Row
                label="Odesláno účetní"
                value={formatDate(invoice.email_sent_at)}
              />
            ) : null}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Položky</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto -mx-6 px-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Popis</TableHead>
                <TableHead className="text-right">Množ.</TableHead>
                <TableHead className="text-right">J. cena bez DPH</TableHead>
                <TableHead className="text-right">DPH %</TableHead>
                <TableHead className="text-right">Bez DPH</TableHead>
                <TableHead className="text-right">Celkem</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((it: { id: string; description: string; quantity: number; unit_price_no_vat: number; vat_rate: number }) => {
                const line = calculateLineTotal(
                  it.quantity,
                  it.unit_price_no_vat,
                  it.vat_rate,
                );
                return (
                  <TableRow key={it.id}>
                    <TableCell>{it.description}</TableCell>
                    <TableCell className="text-right">{it.quantity}</TableCell>
                    <TableCell className="text-right">
                      {formatCZK(it.unit_price_no_vat)}
                    </TableCell>
                    <TableCell className="text-right">{it.vat_rate} %</TableCell>
                    <TableCell className="text-right">
                      {formatCZK(line.noVat)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCZK(line.withVat)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          </div>
          <Separator className="my-4" />
          <div className="flex justify-end">
            <div className="w-full max-w-xs space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Bez DPH</span>
                <span>{formatCZK(totals.noVat)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">DPH</span>
                <span>{formatCZK(totals.vat)}</span>
              </div>
              <Separator />
              <div className="flex justify-between font-semibold text-base">
                <span>Celkem</span>
                <span>{formatCZK(totals.withVat)}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {invoice.notes ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Poznámka</CardTitle>
          </CardHeader>
          <CardContent className="text-sm whitespace-pre-wrap">
            {invoice.notes}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function Row({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className={mono ? "font-mono text-sm" : "tabular-nums"}>
        {value}
      </span>
    </div>
  );
}
