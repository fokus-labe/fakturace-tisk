import { NextResponse, type NextRequest } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import {
  invoiceEditSchema,
  invoiceStatusUpdateSchema,
} from "@/lib/validations/invoice";
import type { InvoiceStatus } from "@/types/invoice";

export const runtime = "nodejs";

// O jaký stav se faktura vrátí při „Vrátit zpět". Koncept a zrušené nelze
// vrátit (koncept je první krok, zrušené se musí vytvořit znovu).
const REVERT_MAP: Partial<Record<InvoiceStatus, InvoiceStatus>> = {
  sent_to_accountant: "draft",
  invoice_issued: "sent_to_accountant",
  archived: "invoice_issued",
};

export async function GET(
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

  const { data, error } = await supabase
    .from("invoice_requests")
    .select("*, client:clients(*), items:invoice_items(*)")
    .eq("id", id)
    .single();
  if (error)
    return NextResponse.json({ error: error.message }, { status: 404 });
  return NextResponse.json({ data });
}

export async function PATCH(
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

  const body = await req.json().catch(() => null);

  // Plný edit konceptu — klient, položky, datum, splatnost, VS, atd.
  if (body && typeof body === "object" && body.action === "edit") {
    return editDraft(supabase, id, body);
  }

  const parsed = invoiceStatusUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  // „Vrátit zpět" — downgrade stavu o jeden krok zpět ve workflow.
  if (parsed.data.action === "revert") {
    return revertStatus(supabase, id);
  }

  const patch: Record<string, unknown> = { ...parsed.data };
  delete patch.action;

  // Prázdný VS ukládáme jako null (ne ""), ať je zobrazení konzistentní.
  if (typeof patch.variable_symbol === "string" && patch.variable_symbol === "") {
    patch.variable_symbol = null;
  }

  // Při přechodu na 'invoice_issued' předvyplnit invoice_issued_at, pokud chybí
  if (patch.status === "invoice_issued" && !patch.invoice_issued_at) {
    patch.invoice_issued_at = new Date().toISOString().slice(0, 10);
  }
  if (patch.external_invoice_number && !patch.status) {
    patch.status = "invoice_issued";
    if (!patch.invoice_issued_at) {
      patch.invoice_issued_at = new Date().toISOString().slice(0, 10);
    }
  }

  const { data, error } = await supabase
    .from("invoice_requests")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

async function editDraft(
  supabase: Awaited<ReturnType<typeof createClient>>,
  id: string,
  body: unknown,
) {
  const parsed = invoiceEditSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { data: current, error: fetchErr } = await supabase
    .from("invoice_requests")
    .select("status")
    .eq("id", id)
    .single();
  if (fetchErr || !current)
    return NextResponse.json({ error: "Faktura nenalezena" }, { status: 404 });

  if (current.status !== "draft") {
    return NextResponse.json(
      { error: "Lze upravit jen koncepty" },
      { status: 400 },
    );
  }

  const input = parsed.data;
  const vs =
    input.variable_symbol && input.variable_symbol.trim().length > 0
      ? input.variable_symbol.trim()
      : null;

  const { data: updated, error: updateErr } = await supabase
    .from("invoice_requests")
    .update({
      client_id: input.client_id,
      issued_at: input.issued_at,
      due_date: input.due_date ?? null,
      variable_symbol: vs,
      payment_method: input.payment_method ?? "fakturace",
      short_description: input.short_description ?? null,
      notes: input.notes ?? null,
    })
    .eq("id", id)
    .select("*")
    .single();
  if (updateErr)
    return NextResponse.json({ error: updateErr.message }, { status: 500 });

  // Nejjednodušší přístup: smazat všechny položky a vložit znovu.
  const { error: delErr } = await supabase
    .from("invoice_items")
    .delete()
    .eq("invoice_request_id", id);
  if (delErr)
    return NextResponse.json({ error: delErr.message }, { status: 500 });

  const itemsRows = input.items.map((it, idx) => ({
    invoice_request_id: id,
    description: it.description,
    quantity: it.quantity,
    unit_price_no_vat: it.unit_price_no_vat,
    vat_rate: it.vat_rate,
    order_index: idx,
  }));
  const { error: insErr } = await supabase
    .from("invoice_items")
    .insert(itemsRows);
  if (insErr)
    return NextResponse.json({ error: insErr.message }, { status: 500 });

  return NextResponse.json({ data: updated });
}

async function revertStatus(
  supabase: Awaited<ReturnType<typeof createClient>>,
  id: string,
) {
  const { data: current, error: fetchErr } = await supabase
    .from("invoice_requests")
    .select("status, pdf_url")
    .eq("id", id)
    .single();
  if (fetchErr || !current)
    return NextResponse.json({ error: "Faktura nenalezena" }, { status: 404 });

  const newStatus = REVERT_MAP[current.status as InvoiceStatus];
  if (!newStatus) {
    return NextResponse.json(
      { error: "Tento stav nelze vrátit zpět" },
      { status: 400 },
    );
  }

  const patch: Record<string, unknown> = { status: newStatus };

  // Návrat do konceptu znamená editovatelné položky → existující PDF je
  // zastaralé. Smažeme ho ze storage a vyčistíme odkazy, aby se podklad
  // při dalším „Připravit podklady" vygeneroval znovu. Stopy po odeslání
  // účetní také mažeme, aby koncept neukazoval „Odesláno účetní" datum
  // z předchozího pokusu.
  if (newStatus === "draft") {
    if (current.pdf_url) {
      const path = String(current.pdf_url).replace(/^invoice-pdfs\//, "");
      const service = createServiceClient();
      await service.storage.from("invoice-pdfs").remove([path]);
      patch.pdf_url = null;
    }
    patch.email_sent_at = null;
    patch.accountant_notified_at = null;
  }

  const { data, error } = await supabase
    .from("invoice_requests")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data, new_status: newStatus });
}

export async function DELETE(
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

  // Načti fakturu kvůli pdf_url a statusu
  const { data: invoice, error: fetchErr } = await supabase
    .from("invoice_requests")
    .select("id, status, pdf_url")
    .eq("id", id)
    .single();
  if (fetchErr || !invoice)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Bezpečnostní kontrola — zákaz mazání vystavených/archivovaných faktur
  if (invoice.status === "invoice_issued" || invoice.status === "archived") {
    return NextResponse.json(
      {
        error:
          "Vystavené nebo archivované faktury nelze smazat. Použij Zrušit místo smazání.",
      },
      { status: 409 },
    );
  }

  // Smaž PDF ze storage, pokud existuje (ignoruj chyby)
  if (invoice.pdf_url) {
    const path = invoice.pdf_url.replace(/^invoice-pdfs\//, "");
    await supabase.storage.from("invoice-pdfs").remove([path]);
  }

  // Smaž položky (CASCADE by to mělo zařídit, ale pro jistotu)
  await supabase.from("invoice_items").delete().eq("invoice_request_id", id);

  const { error } = await supabase
    .from("invoice_requests")
    .delete()
    .eq("id", id);
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  return new NextResponse(null, { status: 204 });
}
