import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getActiveVenue } from "@/lib/venues/get-user-venues";
import { receivedInvoiceBulkSchema } from "@/lib/validations/received-invoice";
import {
  BULK_MAX_IDS,
  type BulkResult,
  type BulkSkip,
} from "@/lib/bulk/constants";
import type { ReceivedInvoiceStatus } from "@/types/received-invoice";

export const runtime = "nodejs";

/**
 * Hromadná akce nad přijatými fakturami (received_invoices).
 *
 * Přechody – stejná pravidla jako jednotlivé přepínání stavů:
 *  - archive: povoleno jen z `paid` → `archived`. `cancelled` se nikdy
 *    nearchivuje, `archived` je už archivovaná, `draft`/`entered` se přeskočí.
 *  - mark_paid: povoleno jen z `entered` → `paid`. `paid_at` se doplní dnešním
 *    datem tam, kde chybí (existující se zachová). Už zaplacené se přeskočí,
 *    ostatní stavy jsou neplatný přechod.
 *
 * Vše běží přes běžného RLS klienta. Příslušnost k aktivní provozovně se
 * navíc vynucuje explicitním filtrem `venue_id`. Operace je množinová (UPDATE
 * nad `in(ids)`), ne smyčka per faktura; neprošlé faktury nezablokují zbytek.
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = receivedInvoiceBulkSchema.safeParse(body);
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
    .from("received_invoices")
    .select("id, status, paid_at")
    .in("id", ids)
    .eq("venue_id", venue.id);
  if (fetchErr)
    return NextResponse.json({ error: fetchErr.message }, { status: 500 });

  const found = new Set((rows ?? []).map((r) => r.id));
  const skipped: BulkSkip[] = [];
  for (const id of ids) {
    if (!found.has(id)) skipped.push({ id, reason: "not_found" });
  }

  const today = new Date().toISOString().slice(0, 10);

  if (action === "archive") {
    const eligible: string[] = [];
    for (const r of rows ?? []) {
      const status = r.status as ReceivedInvoiceStatus;
      if (status === "archived")
        skipped.push({ id: r.id, reason: "already_archived" });
      else if (status === "cancelled")
        skipped.push({ id: r.id, reason: "cancelled" });
      else if (status === "paid") eligible.push(r.id);
      else skipped.push({ id: r.id, reason: "invalid_transition" });
    }

    if (eligible.length) {
      const { error } = await supabase
        .from("received_invoices")
        .update({ status: "archived" })
        .in("id", eligible)
        .eq("venue_id", venue.id);
      if (error)
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const result: BulkResult = { processed: eligible.length, skipped };
    return NextResponse.json(result);
  }

  // action === "mark_paid" — entered → paid, paid_at doplnit jen kde chybí.
  const fill: string[] = []; // paid_at prázdné → doplnit dnešek
  const keep: string[] = []; // paid_at už vyplněné → zachovat
  for (const r of rows ?? []) {
    const status = r.status as ReceivedInvoiceStatus;
    if (status === "paid") {
      skipped.push({ id: r.id, reason: "already_paid" });
    } else if (status !== "entered") {
      skipped.push({ id: r.id, reason: "invalid_transition" });
    } else if (r.paid_at) {
      keep.push(r.id);
    } else {
      fill.push(r.id);
    }
  }

  if (fill.length) {
    const { error } = await supabase
      .from("received_invoices")
      .update({ status: "paid", paid_at: today })
      .in("id", fill)
      .eq("venue_id", venue.id);
    if (error)
      return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (keep.length) {
    const { error } = await supabase
      .from("received_invoices")
      .update({ status: "paid" })
      .in("id", keep)
      .eq("venue_id", venue.id);
    if (error)
      return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const result: BulkResult = { processed: fill.length + keep.length, skipped };
  return NextResponse.json(result);
}
