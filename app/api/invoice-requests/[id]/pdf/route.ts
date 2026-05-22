import { NextResponse, type NextRequest } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { renderInvoicePdf } from "@/lib/pdf/generate-invoice-pdf";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(
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

  if (data.pdf_url) {
    const service = createServiceClient();
    const path = data.pdf_url.replace(/^invoice-pdfs\//, "");
    const { data: file, error: downloadErr } = await service.storage
      .from("invoice-pdfs")
      .download(path);
    if (!downloadErr && file) {
      const buf = Buffer.from(await file.arrayBuffer());
      return new NextResponse(new Uint8Array(buf), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `inline; filename="podklad-${data.variable_symbol ?? id}.pdf"`,
        },
      });
    }
  }

  const items = (data.items ?? []).map(
    (it: { quantity: number | string; unit_price_no_vat: number | string; vat_rate: number | string } & Record<string, unknown>) => ({
      ...it,
      quantity: Number(it.quantity),
      unit_price_no_vat: Number(it.unit_price_no_vat),
      vat_rate: Number(it.vat_rate),
    }),
  );
  const pdfBuffer = await renderInvoicePdf({
    invoice: data,
    client: data.client,
    items,
  });
  return new NextResponse(new Uint8Array(pdfBuffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="podklad-${data.variable_symbol ?? id}.pdf"`,
    },
  });
}
