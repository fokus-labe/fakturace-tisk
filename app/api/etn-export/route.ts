import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { generateEtnXlsx } from "@/lib/etn/generate-xlsx";
import { fetchEtnPeriodData } from "@/lib/etn/fetch-period-data";

export const runtime = "nodejs";

const PeriodSchema = z.object({
  periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  periodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

const SIGNED_URL_TTL = 60 * 60 * 24 * 30; // 30 dní

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = PeriodSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json(
      { error: "Invalid input", issues: parsed.error.issues },
      { status: 400 },
    );

  const { periodStart, periodEnd } = parsed.data;

  let data;
  try {
    data = await fetchEtnPeriodData(supabase, periodStart, periodEnd);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Načtení dat selhalo" },
      { status: 500 },
    );
  }

  const buffer = await generateEtnXlsx({
    periodStart: new Date(periodStart),
    periodEnd: new Date(periodEnd),
    receivedInvoices: data.receivedInvoices,
    issuedInvoices: data.issuedInvoices,
  });

  const filename = `ETN_Fokus_tisk_${periodStart}_${periodEnd}.xlsx`;
  const storagePath = `${Date.now()}_${filename}`;

  const { error: uploadError } = await supabase.storage
    .from("etn-exports")
    .upload(storagePath, new Uint8Array(buffer), {
      contentType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      upsert: true,
    });

  let xlsx_url: string | null = null;
  if (!uploadError) {
    const { data: signed } = await supabase.storage
      .from("etn-exports")
      .createSignedUrl(storagePath, SIGNED_URL_TTL);
    xlsx_url = signed?.signedUrl ?? null;
  }

  const totalReceivedWithVat = data.receivedInvoices.reduce(
    (s, r) => s + r.amount_with_vat,
    0,
  );
  const totalReceivedNoVat = data.receivedInvoices.reduce(
    (s, r) => s + r.amount_no_vat,
    0,
  );
  const totalIssuedWithVat = data.issuedInvoices.reduce(
    (s, r) => s + r.amount_with_vat,
    0,
  );
  const totalIssuedNoVat = data.issuedInvoices.reduce(
    (s, r) => s + r.amount_no_vat,
    0,
  );

  await supabase.from("etn_exports").insert({
    period_start: periodStart,
    period_end: periodEnd,
    exported_by: user.id,
    invoice_count_received: data.receivedInvoices.length,
    invoice_count_issued: data.issuedInvoices.length,
    total_received_with_vat: totalReceivedWithVat,
    total_received_no_vat: totalReceivedNoVat,
    total_issued_with_vat: totalIssuedWithVat,
    total_issued_no_vat: totalIssuedNoVat,
    xlsx_url,
    storage_path: uploadError ? null : storagePath,
    filename,
  });

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(
        filename,
      )}"`,
    },
  });
}
