import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { generateEtnXlsx } from "@/lib/etn/generate-xlsx";
import {
  computeEtnTotals,
  fetchEtnInvoicesByIds,
  type ReceivedRawForZip,
} from "@/lib/etn/fetch-selection-data";
import { ETN_MAX_ISSUED, ETN_MAX_RECEIVED } from "@/lib/etn/limits";
import { getActiveVenue } from "@/lib/venues/get-user-venues";

export const runtime = "nodejs";

const SUPPLIER_BUCKET = "supplier-invoices";
const SIGNED_URL_TTL = 60 * 60 * 24 * 30; // 30 dní

const SelectionSchema = z.object({
  issuedIds: z.array(z.string().uuid()).default([]),
  receivedIds: z.array(z.string().uuid()).default([]),
  periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  periodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  venue: z.string().optional(),
});

// Diakritika → ASCII, bez mezer a oddělovačů (pro názvy souborů v ZIPu).
function ascii(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "");
}

function zipBaseName(raw: ReceivedRawForZip): string {
  const supplier = ascii(raw.supplier_name) || "dodavatel";
  const number = ascii(raw.supplier_invoice_number ?? "") || "bezcisla";
  return `${raw.issued_at}_${supplier}_${number}`;
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = SelectionSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json(
      { error: "Invalid input", issues: parsed.error.issues },
      { status: 400 },
    );

  const { periodStart, periodEnd } = parsed.data;
  const issuedIds = Array.from(new Set(parsed.data.issuedIds));
  const receivedIds = Array.from(new Set(parsed.data.receivedIds));

  if (issuedIds.length === 0 && receivedIds.length === 0)
    return NextResponse.json(
      { error: "Nevybral jsi žádnou fakturu." },
      { status: 400 },
    );

  const venue = await getActiveVenue(parsed.data.venue);
  if (!venue)
    return NextResponse.json({ error: "No venue access" }, { status: 403 });

  // Načti a namapuj vybrané faktury (scoped na provozovnu). Ověř, že všechna id
  // patří do aktivní provozovny — počty musí sedět.
  let picked;
  try {
    picked = await fetchEtnInvoicesByIds(
      supabase,
      venue.id,
      issuedIds,
      receivedIds,
    );
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Načtení faktur selhalo" },
      { status: 500 },
    );
  }

  if (
    picked.foundIssued !== issuedIds.length ||
    picked.foundReceived !== receivedIds.length
  )
    return NextResponse.json(
      {
        error:
          "Některé vybrané faktury nepatří do aktivní provozovny nebo už nejsou platné. Načti náhled znovu.",
      },
      { status: 400 },
    );

  // Tvrdý limit šablony (defense — UI blokuje už dřív).
  if (
    picked.received.length > ETN_MAX_RECEIVED ||
    picked.issued.length > ETN_MAX_ISSUED
  )
    return NextResponse.json(
      {
        error: `Překročen limit šablony (náklady ${picked.received.length}/${ETN_MAX_RECEIVED}, tržby ${picked.issued.length}/${ETN_MAX_ISSUED}). Odškrtni faktury nad limit.`,
      },
      { status: 400 },
    );

  const buffer = await generateEtnXlsx({
    periodStart: new Date(periodStart),
    periodEnd: new Date(periodEnd),
    receivedInvoices: picked.received,
    issuedInvoices: picked.issued,
    venueName: venue.name,
  });

  const filename = `ETN_${venue.slug}_${periodStart}_${periodEnd}.xlsx`;
  const storagePath = `${Date.now()}_${filename}`;

  const { error: uploadError } = await supabase.storage
    .from("etn-exports")
    .upload(storagePath, new Uint8Array(buffer), {
      contentType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      upsert: true,
    });
  if (uploadError)
    return NextResponse.json({ error: uploadError.message }, { status: 500 });

  const { data: signedXlsx } = await supabase.storage
    .from("etn-exports")
    .createSignedUrl(storagePath, SIGNED_URL_TTL, { download: filename });
  const xlsxUrl = signedXlsx?.signedUrl ?? null;

  const totals = computeEtnTotals(picked.received, picked.issued);

  // Vytvoř export + naváž faktury atomicky (jedna transakce v RPC).
  const { data: exportId, error: rpcErr } = await supabase.rpc(
    "create_etn_export_with_links",
    {
      p_venue_id: venue.id,
      p_period_start: periodStart,
      p_period_end: periodEnd,
      p_exported_by: user.id,
      p_invoice_count_received: picked.received.length,
      p_invoice_count_issued: picked.issued.length,
      p_total_received_with_vat: totals.receivedWithVat,
      p_total_received_no_vat: totals.receivedNoVat,
      p_total_issued_with_vat: totals.issuedWithVat,
      p_total_issued_no_vat: totals.issuedNoVat,
      p_xlsx_url: xlsxUrl,
      p_storage_path: storagePath,
      p_filename: filename,
      p_issued_ids: issuedIds,
      p_received_ids: receivedIds,
    },
  );

  if (rpcErr || !exportId) {
    // Úklid nahraného XLSX, ať nezůstane orphan bez DB řádku.
    await supabase.storage.from("etn-exports").remove([storagePath]);
    return NextResponse.json(
      { error: rpcErr?.message ?? "Uložení exportu selhalo" },
      { status: 500 },
    );
  }

  // Signed URL pro PDF přílohy přijatých faktur placených fakturou (pro ZIP).
  // hotovost/dobírka/dodací list do ZIPu nepatří — jde jen o faktury.
  const fakturaReceived = picked.receivedRaw.filter(
    (r) => r.payment_method === "faktura",
  );
  const receivedPdfs: Array<{ url: string; name: string }> = [];
  const missingPdfs: Array<{ label: string }> = [];

  for (const raw of fakturaReceived) {
    const label = `${raw.supplier_name}${
      raw.supplier_invoice_number ? ` (${raw.supplier_invoice_number})` : ""
    }`;
    if (!raw.pdf_url) {
      missingPdfs.push({ label });
      continue;
    }
    const path = raw.pdf_url.replace(/^supplier-invoices\//, "");
    const base = zipBaseName(raw);
    if (path.endsWith("/")) {
      // Podsložka s naskenovanými stranami — podepiš každý soubor zvlášť.
      const folder = path.replace(/\/$/, "");
      const { data: files } = await supabase.storage
        .from(SUPPLIER_BUCKET)
        .list(folder);
      let idx = 1;
      for (const f of files ?? []) {
        const { data: signed } = await supabase.storage
          .from(SUPPLIER_BUCKET)
          .createSignedUrl(`${folder}/${f.name}`, SIGNED_URL_TTL);
        if (signed?.signedUrl) {
          const ext = f.name.includes(".")
            ? f.name.slice(f.name.lastIndexOf("."))
            : "";
          receivedPdfs.push({ url: signed.signedUrl, name: `${base}_${idx}${ext}` });
        }
        idx++;
      }
    } else {
      const { data: signed } = await supabase.storage
        .from(SUPPLIER_BUCKET)
        .createSignedUrl(path, SIGNED_URL_TTL);
      if (signed?.signedUrl) {
        const ext = path.includes(".")
          ? path.slice(path.lastIndexOf("."))
          : ".pdf";
        receivedPdfs.push({ url: signed.signedUrl, name: `${base}${ext}` });
      }
    }
  }

  return NextResponse.json({
    export_id: exportId,
    xlsx: { url: xlsxUrl, filename },
    zipName: filename.replace(/\.xlsx$/, ".zip"),
    receivedPdfs,
    missingPdfs,
  });
}
