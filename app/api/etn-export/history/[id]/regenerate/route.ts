import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateEtnXlsx } from "@/lib/etn/generate-xlsx";
import { fetchEtnPeriodData } from "@/lib/etn/fetch-period-data";

export const runtime = "nodejs";

const SIGNED_URL_TTL = 60 * 60 * 24 * 30;

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

  const { data: exp, error: fetchErr } = await supabase
    .from("etn_exports")
    .select("*")
    .eq("id", id)
    .single();
  if (fetchErr || !exp)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Pokud existuje storage_path, jen vygenerujeme nový signed URL
  if (exp.storage_path) {
    const { data: head } = await supabase.storage
      .from("etn-exports")
      .createSignedUrl(exp.storage_path, SIGNED_URL_TTL);
    if (head?.signedUrl) {
      await supabase
        .from("etn_exports")
        .update({ xlsx_url: head.signedUrl })
        .eq("id", id);
      return NextResponse.json({ xlsx_url: head.signedUrl });
    }
  }

  // Jinak vygenerujeme XLSX znovu z aktuálních dat
  let data;
  try {
    data = await fetchEtnPeriodData(
      supabase,
      exp.period_start,
      exp.period_end,
    );
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Načtení dat selhalo" },
      { status: 500 },
    );
  }

  const buffer = await generateEtnXlsx({
    periodStart: new Date(exp.period_start),
    periodEnd: new Date(exp.period_end),
    receivedInvoices: data.receivedInvoices,
    issuedInvoices: data.issuedInvoices,
  });

  const storagePath = `${Date.now()}_${exp.filename}`;
  const { error: uploadError } = await supabase.storage
    .from("etn-exports")
    .upload(storagePath, new Uint8Array(buffer), {
      contentType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      upsert: true,
    });
  if (uploadError)
    return NextResponse.json(
      { error: uploadError.message },
      { status: 500 },
    );

  const { data: signed } = await supabase.storage
    .from("etn-exports")
    .createSignedUrl(storagePath, SIGNED_URL_TTL);

  await supabase
    .from("etn_exports")
    .update({ xlsx_url: signed?.signedUrl ?? null, storage_path: storagePath })
    .eq("id", id);

  return NextResponse.json({ xlsx_url: signed?.signedUrl ?? null });
}
