import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { detectServerKind } from "@/lib/import/server-validate";

export const runtime = "nodejs";

const MAX_SIZE = 10 * 1024 * 1024; // 10 MB / soubor
const MAX_PAGES = 5;

const EXT: Record<string, string> = {
  pdf: "pdf",
  jpeg: "jpg",
  png: "png",
  webp: "webp",
};
const CONTENT_TYPE: Record<string, string> = {
  pdf: "application/pdf",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

/**
 * Uloží originál přijaté faktury do storage.
 * - jedno PDF -> `{id}.pdf`, pdf_url = `supplier-invoices/{id}.pdf` (zpětně kompatibilní)
 * - jeden a víc obrázků (strany) -> `{id}/1.jpg`, `{id}/2.jpg`…, pdf_url = `supplier-invoices/{id}/`
 */
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

  const files = [
    ...formData.getAll("files"),
    ...formData.getAll("file"),
  ].filter((f): f is File => f instanceof File);
  if (files.length === 0)
    return NextResponse.json({ error: "Chybí soubor" }, { status: 400 });
  if (files.length > MAX_PAGES)
    return NextResponse.json(
      { error: `Max ${MAX_PAGES} stran na fakturu` },
      { status: 400 },
    );

  // Rozpoznej typy z magic bytes (nedůvěřuj MIME).
  const prepared: Array<{ kind: string; bytes: Uint8Array }> = [];
  for (const file of files) {
    if (file.size > MAX_SIZE)
      return NextResponse.json(
        { error: `Soubor ${file.name} je větší než 10 MB` },
        { status: 400 },
      );
    const buffer = Buffer.from(await file.arrayBuffer());
    const kind = detectServerKind(buffer);
    if (kind === null)
      return NextResponse.json(
        { error: `Nepodporovaný formát souboru ${file.name}` },
        { status: 400 },
      );
    prepared.push({ kind, bytes: new Uint8Array(buffer) });
  }

  const hasPdf = prepared.some((p) => p.kind === "pdf");
  if (hasPdf && prepared.length > 1)
    return NextResponse.json(
      { error: "PDF nelze kombinovat s dalšími stranami" },
      { status: 400 },
    );

  let pdf_url: string;

  if (hasPdf) {
    const path = `${id}.pdf`;
    const { error: uploadErr } = await supabase.storage
      .from("supplier-invoices")
      .upload(path, prepared[0].bytes, {
        contentType: "application/pdf",
        upsert: true,
      });
    if (uploadErr)
      return NextResponse.json({ error: uploadErr.message }, { status: 500 });
    pdf_url = `supplier-invoices/${path}`;
  } else {
    // víc obrázků -> podsložka {id}/
    for (let i = 0; i < prepared.length; i++) {
      const p = prepared[i];
      const path = `${id}/${i + 1}.${EXT[p.kind]}`;
      const { error: uploadErr } = await supabase.storage
        .from("supplier-invoices")
        .upload(path, p.bytes, {
          contentType: CONTENT_TYPE[p.kind],
          upsert: true,
        });
      if (uploadErr)
        return NextResponse.json({ error: uploadErr.message }, { status: 500 });
    }
    pdf_url = `supplier-invoices/${id}/`;
  }

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
