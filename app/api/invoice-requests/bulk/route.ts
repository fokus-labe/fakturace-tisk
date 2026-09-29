import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getActiveVenue } from "@/lib/venues/get-user-venues";
import { invoiceBulkSchema } from "@/lib/validations/invoice";
import {
  BULK_MAX_IDS,
  type BulkResult,
  type BulkSkip,
} from "@/lib/bulk/constants";
import type { InvoiceStatus } from "@/types/invoice";

export const runtime = "nodejs";

/**
 * Hromadná akce nad vydanými fakturami (invoice_requests).
 *
 * Přechody – stejná pravidla jako jednotlivé přepínání stavů:
 *  - archive: povoleno jen z `invoice_issued` → `archived`. `cancelled` se
 *    nikdy nearchivuje, `archived` je už archivovaná, ostatní stavy se přeskočí.
 *  - mark_paid: vydané faktury nemají stav „zaplaceno" — jen se doplní `paid_at`
 *    (dnešní datum) tam, kde chybí, u faktur ve stavu `invoice_issued` /
 *    `archived`. Stav se nemění. Už zaplacené (paid_at != null) se přeskočí.
 *
 * Vše běží přes běžného RLS klienta. Příslušnost k aktivní provozovně se
 * navíc vynucuje explicitním filtrem `venue_id`. Operace je množinová (jeden
 * UPDATE nad `in(ids)`), ne smyčka per faktura; neprošlé faktury nezablokují zbytek.
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = invoiceBulkSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Neplatný vstup", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { action } = parsed.data;
  const ids = Array.from(new Set(parsed.data.ids));
  if (ids.length > BULK_MAX_IDS) {
    return NextResponse.json(
      {
        error: `Najednou lze zpracovat nejvýše ${BULK_MAX_IDS} faktur. Zmenši výběr.`,
      },
      { status: 400 },
    );
  }

  const venue = await getActiveVenue();
  if (!venue)
    return NextResponse.json({ error: "No venue access" }, { status: 403 });

  // Jeden dotaz — načti cílové faktury omezené na aktivní provozovnu.
  const { data: rows, error: fetchErr } = await supabase
    .from("invoice_requests")
    .select("id, status, paid_at")
    .in("id", ids)
    .eq("venue_id", venue.id);
  if (fetchErr)
    return NextResponse.json({ error: fetchErr.message }, { status: 500 });

  const found = new Set((rows ?? []).map((r) => r.id));
  const skipped: BulkSkip[] = [];
  // Id, která ve venue neexistují (cizí provozovna / smazané) → přeskoč.
  for (const id of ids) {
    if (!found.has(id)) skipped.push({ id, reason: "not_found" });
  }

  const today = new Date().toISOString().slice(0, 10);

  if (action === "archive") {
    const eligible: string[] = [];
    for (const r of rows ?? []) {
      const status = r.status as InvoiceStatus;
      if (status === "archived")
        skipped.push({ id: r.id, reason: "already_archived" });
      else if (status === "cancelled")
        skipped.push({ id: r.id, reason: "cancelled" });
      else if (status === "invoice_issued") eligible.push(r.id);
      else skipped.push({ id: r.id, reason: "invalid_transition" });
    }

    if (eligible.length) {
      const { error } = await supabase
        .from("invoice_requests")
        .update({ status: "archived" })
        .in("id", eligible)
        .eq("venue_id", venue.id);
      if (error)
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const result: BulkResult = { processed: eligible.length, skipped };
    return NextResponse.json(result);
  }

  // action === "mark_paid" — jen doplnit paid_at, stav se nemění.
  const fill: string[] = [];
  for (const r of rows ?? []) {
    const status = r.status as InvoiceStatus;
    const payable = status === "invoice_issued" || status === "archived";
    if (!payable) {
      skipped.push({ id: r.id, reason: "invalid_transition" });
    } else if (r.paid_at) {
      skipped.push({ id: r.id, reason: "already_paid" });
    } else {
      fill.push(r.id);
    }
  }

  if (fill.length) {
    const { error } = await supabase
      .from("invoice_requests")
      .update({ paid_at: today })
      .in("id", fill)
      .eq("venue_id", venue.id);
    if (error)
      return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const result: BulkResult = { processed: fill.length, skipped };
  return NextResponse.json(result);
}
