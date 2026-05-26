import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

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

  const { data: invoice, error: fetchErr } = await supabase
    .from("received_invoices")
    .select("pdf_url")
    .eq("id", id)
    .single();
  if (fetchErr || !invoice?.pdf_url)
    return NextResponse.json({ error: "PDF není k dispozici" }, { status: 404 });

  const path = invoice.pdf_url.replace(/^supplier-invoices\//, "");
  const { data, error } = await supabase.storage
    .from("supplier-invoices")
    .download(path);
  if (error || !data)
    return NextResponse.json({ error: "PDF nelze stáhnout" }, { status: 500 });

  const buffer = Buffer.from(await data.arrayBuffer());
  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${id}.pdf"`,
    },
  });
}
