import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateEtnXlsx } from "@/lib/etn/generate-xlsx";
import { fetchEtnInvoicesByExportId } from "@/lib/etn/fetch-selection-data";

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

  // Provozovnu bereme z uloženého řádku — nikdy tichý fallback na fokus-tisk,
  // jinak by regenerovaný XLSX agregoval data napříč provozovnami.
  if (!exp.venue_id)
    return NextResponse.json(
      {
        error:
          "Historický export nemá přiřazenou provozovnu, nelze ho regenerovat. Vygeneruj export znovu z aktuálních dat.",
      },
      { status: 400 },
    );

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

  // Jinak vygenerujeme XLSX znovu z aktuálních dat — vždy scoped na provozovnu
  // uloženou u exportu.
  const { data: venue, error: venueErr } = await supabase
    .from("venues")
    .select("id, slug, name")
    .eq("id", exp.venue_id)
    .maybeSingle();
  if (venueErr || !venue)
    return NextResponse.json(
      { error: "Provozovnu exportu se nepodařilo načíst" },
      { status: 400 },
    );

  // Zdroj dat = faktury navázané na tento export (etn_export_id), NE opětovný
  // dotaz podle období. Jinak by se do starého exportu propsaly pozdější změny.
  // Období slouží už jen do hlavičky a názvu souboru.
  let data;
  try {
    data = await fetchEtnInvoicesByExportId(supabase, venue.id, id);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Načtení dat selhalo" },
      { status: 500 },
    );
  }

  const buffer = await generateEtnXlsx({
    periodStart: new Date(exp.period_start),
    periodEnd: new Date(exp.period_end),
    receivedInvoices: data.received,
    issuedInvoices: data.issued,
    venueName: venue.name,
  });

  // Filename sestavujeme stejně jako původní POST export.
  const filename = `ETN_${venue.slug}_${exp.period_start}_${exp.period_end}.xlsx`;
  const storagePath = `${Date.now()}_${filename}`;
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
    .update({
      xlsx_url: signed?.signedUrl ?? null,
      storage_path: storagePath,
      filename,
    })
    .eq("id", id);

  return NextResponse.json({ xlsx_url: signed?.signedUrl ?? null });
}
