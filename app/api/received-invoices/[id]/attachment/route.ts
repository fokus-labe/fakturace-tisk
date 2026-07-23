import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const CONTENT_TYPE: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  pdf: "application/pdf",
};

/**
 * Náhled přílohy přijaté faktury.
 * - GET bez parametru -> JSON: { kind: "pdf" } nebo { kind: "images", pages: ["1.jpg", ...] }
 * - GET ?file=<name>  -> stáhne konkrétní stranu (obrázek) z podsložky {id}/
 */
export async function GET(
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

  const { data: invoice, error: fetchErr } = await supabase
    .from("received_invoices")
    .select("pdf_url")
    .eq("id", id)
    .single();
  if (fetchErr || !invoice?.pdf_url)
    return NextResponse.json({ error: "Příloha není k dispozici" }, {
      status: 404,
    });

  const url: string = invoice.pdf_url;
  const isFolder = url.endsWith("/");

  const file = req.nextUrl.searchParams.get("file");
  if (file) {
    // Serve konkrétní stranu — jen bezpečné názvy uvnitř podsložky {id}/.
    if (!/^\d+\.(jpg|jpeg|png|webp)$/.test(file)) {
      return NextResponse.json({ error: "Neplatný soubor" }, { status: 400 });
    }
    const ext = file.split(".").pop() ?? "";
    const { data, error } = await supabase.storage
      .from("supplier-invoices")
      .download(`${id}/${file}`);
    if (error || !data)
      return NextResponse.json({ error: "Stranu nelze stáhnout" }, {
        status: 404,
      });
    const buffer = Buffer.from(await data.arrayBuffer());
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": CONTENT_TYPE[ext] ?? "application/octet-stream",
        "Cache-Control": "private, max-age=3600",
      },
    });
  }

  if (!isFolder) {
    // Jedno PDF — servíruje ho existující /pdf route.
    return NextResponse.json({ kind: "pdf" });
  }

  const { data: list, error: listErr } = await supabase.storage
    .from("supplier-invoices")
    .list(id);
  if (listErr)
    return NextResponse.json({ error: listErr.message }, { status: 500 });

  const pages = (list ?? [])
    .map((f) => f.name)
    .filter((n) => /^\d+\.(jpg|jpeg|png|webp)$/.test(n))
    .sort(
      (a, b) => parseInt(a, 10) - parseInt(b, 10),
    );

  return NextResponse.json({ kind: "images", pages });
}
