import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const MAX_SIZE = 5 * 1024 * 1024; // 5 MB

export async function POST(
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

  // Ověř existenci přijaté faktury
  const { data: existing, error: fetchErr } = await supabase
    .from("received_invoices")
    .select("id")
    .eq("id", id)
    .single();
  if (fetchErr || !existing)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const formData = await req.formData().catch(() => null);
  if (!formData)
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });

  const file = formData.get("file");
  if (!(file instanceof File))
    return NextResponse.json({ error: "Chybí soubor" }, { status: 400 });

  if (file.size > MAX_SIZE)
    return NextResponse.json(
      { error: "Soubor je větší než 5 MB" },
      { status: 400 },
    );

  if (file.type !== "application/pdf")
    return NextResponse.json(
      { error: "Soubor musí být PDF" },
      { status: 400 },
    );

  const path = `${id}.pdf`;
  const bytes = new Uint8Array(await file.arrayBuffer());

  const { error: uploadErr } = await supabase.storage
    .from("supplier-invoices")
    .upload(path, bytes, {
      contentType: "application/pdf",
      upsert: true,
    });
  if (uploadErr)
    return NextResponse.json({ error: uploadErr.message }, { status: 500 });

  const pdf_url = `supplier-invoices/${path}`;
  const { data, error: updateErr } = await supabase
    .from("received_invoices")
    .update({ pdf_url })
    .eq("id", id)
    .select("*")
    .single();
  if (updateErr)
    return NextResponse.json({ error: updateErr.message }, { status: 500 });

  return NextResponse.json({ data });
}
