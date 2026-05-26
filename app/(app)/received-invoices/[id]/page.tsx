import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Edit, FileText } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ReceivedInvoiceStatusBadge } from "@/components/received-invoice/received-invoice-status-badge";
import { ReceivedInvoiceStepper } from "@/components/received-invoice/received-invoice-stepper";
import { ReceivedInvoiceActions } from "./received-invoice-actions";
import { formatCZK, formatDate } from "@/lib/utils/format";
import {
  RECEIVED_INVOICE_CATEGORY_LABELS,
  RECEIVED_PAYMENT_METHOD_LABELS,
  type ReceivedInvoiceCategory,
  type ReceivedPaymentMethod,
} from "@/types/received-invoice";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ReceivedInvoiceDetailPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: invoice } = await supabase
    .from("received_invoices")
    .select("*, supplier:suppliers(*)")
    .eq("id", id)
    .single();
  if (!invoice) notFound();

  return (
    <div className="space-y-6">
      <Link
        href="/received-invoices"
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4 mr-1" />
        Přijaté faktury
      </Link>

      <div className="space-y-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-semibold tracking-tight">
                {invoice.supplier?.name ?? "—"}
              </h1>
              <ReceivedInvoiceStatusBadge status={invoice.status} />
            </div>
            <p className="text-sm text-muted-foreground">
              {invoice.supplier_invoice_number
                ? `Č. ${invoice.supplier_invoice_number} · `
                : ""}
              {formatDate(invoice.issued_at)}
            </p>
          </div>
          <Link
            href={`/received-invoices/${invoice.id}/edit`}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            <Edit className="size-4 mr-2" />
            Upravit
          </Link>
        </div>

        <Card>
          <CardContent className="py-4">
            <ReceivedInvoiceStepper status={invoice.status} />
          </CardContent>
        </Card>

        <ReceivedInvoiceActions
          invoiceId={invoice.id}
          status={invoice.status}
          paidAt={invoice.paid_at}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Dodavatel</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-0.5">
            <div className="font-semibold">{invoice.supplier?.name}</div>
            {invoice.supplier?.address_street ? (
              <div>{invoice.supplier.address_street}</div>
            ) : null}
            {invoice.supplier?.address_city || invoice.supplier?.address_zip ? (
              <div>
                {invoice.supplier?.address_zip ?? ""}{" "}
                {invoice.supplier?.address_city ?? ""}
              </div>
            ) : null}
            {invoice.supplier?.ico ? (
              <div className="text-muted-foreground">
                IČO:{" "}
                <span className="font-mono text-sm">{invoice.supplier.ico}</span>
              </div>
            ) : null}
            {invoice.supplier?.dic ? (
              <div className="text-muted-foreground">
                DIČ:{" "}
                <span className="font-mono text-sm">{invoice.supplier.dic}</span>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Detaily</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-1.5">
            <Row label="Datum vystavení" value={formatDate(invoice.issued_at)} />
            <Row label="Splatnost" value={formatDate(invoice.due_date)} />
            {invoice.paid_at ? (
              <Row label="Zaplaceno" value={formatDate(invoice.paid_at)} />
            ) : null}
            <Row
              label="Způsob platby"
              value={
                RECEIVED_PAYMENT_METHOD_LABELS[
                  invoice.payment_method as ReceivedPaymentMethod
                ]
              }
            />
            <Row
              label="Kategorie"
              value={
                RECEIVED_INVOICE_CATEGORY_LABELS[
                  invoice.category as ReceivedInvoiceCategory
                ]
              }
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Popis & Částka</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div>
            <div className="text-muted-foreground text-xs uppercase tracking-wide mb-1">
              Popis
            </div>
            <div>{invoice.description}</div>
          </div>
          <div className="grid grid-cols-3 gap-4 pt-2 border-t">
            <div>
              <div className="text-muted-foreground text-xs uppercase tracking-wide">
                Bez DPH
              </div>
              <div>{formatCZK(Number(invoice.amount_no_vat))}</div>
            </div>
            <div>
              <div className="text-muted-foreground text-xs uppercase tracking-wide">
                DPH
              </div>
              <div>{formatCZK(Number(invoice.amount_vat))}</div>
            </div>
            <div>
              <div className="text-muted-foreground text-xs uppercase tracking-wide">
                Celkem
              </div>
              <div className="font-semibold">
                {formatCZK(Number(invoice.amount_total))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {invoice.pdf_url ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="size-4" />
              PDF příloha
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <a
              href={`/api/received-invoices/${invoice.id}/pdf`}
              target="_blank"
              rel="noopener noreferrer"
              className="underline text-sm"
            >
              Otevřít v novém okně
            </a>
            <iframe
              src={`/api/received-invoices/${invoice.id}/pdf`}
              className="w-full h-[600px] rounded-md border"
              title="PDF přílohy"
            />
          </CardContent>
        </Card>
      ) : null}

      {invoice.notes ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Poznámky</CardTitle>
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
