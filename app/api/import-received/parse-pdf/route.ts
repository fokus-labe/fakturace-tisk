import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { extractReceivedInvoiceFromSources } from "@/lib/anthropic/extract-received-invoice";
import { validateInvoiceFiles } from "@/lib/import/server-validate";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY není nastaven na serveru" },
      { status: 500 },
    );
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  // Jedna faktura = 1+ souborů v pořadí stran. Zpětně kompatibilní se starým "file".
  const files = [
    ...formData.getAll("files"),
    ...formData.getAll("file"),
  ].filter((f): f is File => f instanceof File);
  if (files.length === 0) {
    return NextResponse.json({ error: "Soubor chybí" }, { status: 400 });
  }

  let validated;
  try {
    validated = await validateInvoiceFiles(files);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Neplatné soubory" },
      { status: 400 },
    );
  }

  try {
    const { extracted, usage } = await extractReceivedInvoiceFromSources(
      validated.sources,
      validated.multiPageImage,
    );

    console.log(
      `[OCR received] ${files.map((f) => f.name).join(", ")} (${files.length} str.): in ${usage.input_tokens} / out ${usage.output_tokens} tokens`,
    );

    return NextResponse.json({
      success: true,
      filename: files[0]?.name ?? null,
      extracted,
      usage,
    });
  } catch (err) {
    console.error("[import-received/parse-pdf]", err);
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "OCR se nepodařilo",
      },
      { status: 500 },
    );
  }
}
