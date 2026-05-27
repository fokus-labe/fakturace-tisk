import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { extractInvoiceFromPdf } from "@/lib/anthropic/extract-invoice";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

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

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Soubor chybí" }, { status: 400 });
  }
  if (file.type !== "application/pdf") {
    return NextResponse.json(
      { error: "Pouze PDF soubory jsou akceptovány" },
      { status: 400 },
    );
  }
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: "PDF je příliš velký (max 10 MB)" },
      { status: 400 },
    );
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const base64 = buffer.toString("base64");

    const { extracted, usage } = await extractInvoiceFromPdf(base64);

    console.log(
      `[OCR] ${file.name}: in ${usage.input_tokens} / out ${usage.output_tokens} tokens`,
    );

    return NextResponse.json({
      success: true,
      filename: file.name,
      extracted,
      usage,
    });
  } catch (err) {
    console.error("[import/parse-pdf]", err);
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "OCR se nepodařilo",
      },
      { status: 500 },
    );
  }
}
