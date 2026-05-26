import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { receivedInvoiceSchema } from "@/lib/validations/received-invoice";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const category = searchParams.get("category");
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const limit = Math.min(Number(searchParams.get("limit") ?? 100), 500);

  let query = supabase
    .from("received_invoices")
    .select("*, supplier:suppliers(*)")
    .order("issued_at", { ascending: false })
    .limit(limit);

  if (status) query = query.eq("status", status);
  if (category) query = query.eq("category", category);
  if (from) query = query.gte("issued_at", from);
  if (to) query = query.lte("issued_at", to);

  const { data, error } = await query;
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = receivedInvoiceSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 },
    );

  const input = parsed.data;

  // Pokud status=paid a chybí paid_at, doplň dnešní datum
  let paid_at = input.paid_at ?? null;
  if (input.status === "paid" && !paid_at) {
    paid_at = new Date().toISOString().slice(0, 10);
  }

  const { data, error } = await supabase
    .from("received_invoices")
    .insert({
      supplier_id: input.supplier_id,
      supplier_invoice_number: input.supplier_invoice_number ?? null,
      issued_at: input.issued_at,
      due_date: input.due_date ?? null,
      paid_at,
      payment_method: input.payment_method,
      amount_no_vat: input.amount_no_vat,
      amount_vat: input.amount_vat,
      amount_total: input.amount_total,
      description: input.description,
      category: input.category,
      pdf_url: input.pdf_url ?? null,
      status: input.status,
      notes: input.notes ?? null,
      created_by: user.id,
    })
    .select("*")
    .single();
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data }, { status: 201 });
}
