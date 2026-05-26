import { NextResponse, type NextRequest } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { renderInvoicePdf } from "@/lib/pdf/generate-invoice-pdf";
import { buildAccountantMailto } from "@/lib/email/mailto";
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

  const mailto = buildAccountantMailto({
    client: { name: client.name, ico: client.ico },
    totals,
    dueDate: data.due_date ?? data.issued_at,
    variableSymbol: data.variable_symbol ?? "",
  });

  const now = new Date().toISOString();
  await supabase
    .from("invoice_requests")
    .update({
      pdf_url: pdfUrl,
      email_sent_at: now,
      accountant_notified_at: now,
    })
    .eq("id", id);

  return NextResponse.json({
    pdf_url: pdfUrl,
    mailto_link: mailto.href,
    subject: mailto.subject,
    body: mailto.body,
  });
}
