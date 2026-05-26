import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { invoiceStatusUpdateSchema } from "@/lib/validations/invoice";

export const runtime = "nodejs";

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
  if (error)
    return NextResponse.json({ error: error.message }, { status: 404 });
  return NextResponse.json({ data });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = invoiceStatusUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const patch: Record<string, unknown> = { ...parsed.data };

  // Při přechodu na 'invoice_issued' předvyplnit invoice_issued_at, pokud chybí
  if (patch.status === "invoice_issued" && !patch.invoice_issued_at) {
    patch.invoice_issued_at = new Date().toISOString().slice(0, 10);
  }
  if (patch.external_invoice_number && !patch.status) {
    patch.status = "invoice_issued";
    if (!patch.invoice_issued_at) {
      patch.invoice_issued_at = new Date().toISOString().slice(0, 10);
    }
  }

  const { data, error } = await supabase
    .from("invoice_requests")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

export async function DELETE(
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

  // Načti fakturu kvůli pdf_url a statusu
  const { data: invoice, error: fetchErr } = await supabase
    .from("invoice_requests")
    .select("id, status, pdf_url")
    .eq("id", id)
    .single();
  if (fetchErr || !invoice)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Bezpečnostní kontrola — zákaz mazání vystavených/archivovaných faktur
  if (invoice.status === "invoice_issued" || invoice.status === "archived") {
    return NextResponse.json(
      {
        error:
          "Vystavené nebo archivované faktury nelze smazat. Použij Zrušit místo smazání.",
      },
      { status: 409 },
    );
  }

  // Smaž PDF ze storage, pokud existuje (ignoruj chyby)
  if (invoice.pdf_url) {
    const path = invoice.pdf_url.replace(/^invoice-pdfs\//, "");
    await supabase.storage.from("invoice-pdfs").remove([path]);
  }

  // Smaž položky (CASCADE by to mělo zařídit, ale pro jistotu)
  await supabase.from("invoice_items").delete().eq("invoice_request_id", id);

  const { error } = await supabase
    .from("invoice_requests")
    .delete()
    .eq("id", id);
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  return new NextResponse(null, { status: 204 });
}
