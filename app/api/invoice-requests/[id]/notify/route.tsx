import { NextResponse, type NextRequest } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { renderInvoicePdf } from "@/lib/pdf/generate-invoice-pdf";
import { getResend } from "@/lib/email/resend";
import {
  InvoiceRequestEmail,
  invoiceRequestSubject,
} from "@/lib/email/templates/invoice-request";
import { calculateInvoiceTotals } from "@/lib/utils/vat";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("invoice_requests")
    .select("*, client:clients(*), items:invoice_items(*)")
    .eq("id", id)
    .single();
  if (error || !data)
    return NextResponse.json(
      { error: error?.message ?? "Faktura nenalezena" },
      { status: 404 },
    );

  const client = data.client;
  const items = (data.items ?? []).map(
    (it: { quantity: number | string; unit_price_no_vat: number | string; vat_rate: number | string } & Record<string, unknown>) => ({
      ...it,
      quantity: Number(it.quantity),
      unit_price_no_vat: Number(it.unit_price_no_vat),
      vat_rate: Number(it.vat_rate),
    }),
  );
  const totals = calculateInvoiceTotals(items);

  const pdfBuffer = await renderInvoicePdf({
    invoice: data,
    client,
    items,
  });

  const service = createServiceClient();
  const storagePath = `${id}.pdf`;
  const { error: uploadErr } = await service.storage
    .from("invoice-pdfs")
    .upload(storagePath, pdfBuffer, {
      contentType: "application/pdf",
      upsert: true,
    });
  if (uploadErr) {
    return NextResponse.json({ error: uploadErr.message }, { status: 500 });
  }
  const pdfUrl = `invoice-pdfs/${storagePath}`;

  const accountantEmail =
    process.env.ACCOUNTANT_EMAIL ?? "calek@fokuslabe.cz";
  const accountantName = process.env.ACCOUNTANT_NAME ?? "Petře";
  const from = process.env.RESEND_FROM_EMAIL ?? "fakturace@fokuslabe.cz";

  const subject = invoiceRequestSubject({ client, totals });
  const filename = `podklad-${data.variable_symbol ?? id}.pdf`;

  const resend = getResend();
  const { error: emailErr } = await resend.emails.send({
    from,
    to: accountantEmail,
    subject,
    react: (
      <InvoiceRequestEmail
        invoice={data}
        client={client}
        totals={totals}
        accountantName={accountantName}
      />
    ),
    attachments: [
      {
        filename,
        content: pdfBuffer.toString("base64"),
      },
    ],
  });
  if (emailErr) {
    return NextResponse.json(
      { error: emailErr.message ?? "Email se nepodařilo odeslat" },
      { status: 500 },
    );
  }

  const now = new Date().toISOString();
  await supabase
    .from("invoice_requests")
    .update({
      pdf_url: pdfUrl,
      email_sent_at: now,
      accountant_notified_at: now,
      status: "sent_to_accountant",
    })
    .eq("id", id);

  return NextResponse.json({ ok: true });
}
