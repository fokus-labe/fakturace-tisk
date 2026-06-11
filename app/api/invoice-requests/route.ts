import { NextResponse, type NextRequest } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import {
  authenticateApiKey,
  isApiKeyHeader,
} from "@/lib/auth/api-key";
import { invoiceRequestSchema } from "@/lib/validations/invoice";
import {
  getActiveVenue,
  getVenueIdBySlug,
  DEFAULT_VENUE_SLUG,
} from "@/lib/venues/get-user-venues";

export const runtime = "nodejs";

type AuthOk = {
  ok: true;
  mode: "user" | "api_key";
  service: ReturnType<typeof createServiceClient>;
  userId: string | null;
};

async function authenticate(req: NextRequest): Promise<AuthOk | { ok: false }> {
  const apiKey = isApiKeyHeader(req.headers.get("authorization"));
  if (apiKey) {
    const service = createServiceClient();
    const auth = await authenticateApiKey(service, apiKey);
    if (!auth) return { ok: false as const };
    return { ok: true as const, mode: "api_key" as const, service, userId: null };
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const };
  return {
    ok: true as const,
    mode: "user" as const,
    service: supabase as unknown as ReturnType<typeof createServiceClient>,
    userId: user.id,
  };
}

/**
 * Resolve venue_id pro daný auth kontext.
 * - user: aktivní venue (default fokus-tisk) přes RLS klienta
 * - api_key (eshop): default fokus-tisk přes service klienta
 */
async function resolveVenueId(
  auth: AuthOk,
  slug?: string,
): Promise<string | null> {
  if (auth.mode === "user") {
    const venue = await getActiveVenue(slug);
    return venue?.id ?? null;
  }
  return getVenueIdBySlug(auth.service, slug ?? DEFAULT_VENUE_SLUG);
}

export async function GET(req: NextRequest) {
  const auth = await authenticate(req);
  if (!auth.ok)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const q = searchParams.get("q");
  const limit = Math.min(Number(searchParams.get("limit") ?? 50), 200);

  const venueId = await resolveVenueId(
    auth,
    searchParams.get("venue") ?? undefined,
  );
  if (!venueId)
    return NextResponse.json({ error: "No venue access" }, { status: 403 });

  let query = auth.service
    .from("invoice_requests")
    .select("*, client:clients(*), items:invoice_items(*)")
    .eq("venue_id", venueId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (status) query = query.eq("status", status);

  const { data, error } = await query;
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  let result = data ?? [];
  if (q) {
    const needle = q.toLowerCase();
    result = result.filter((r) =>
      (r.client?.name ?? "").toLowerCase().includes(needle),
    );
  }
  return NextResponse.json({ data: result });
}

export async function POST(req: NextRequest) {
  const auth = await authenticate(req);
  if (!auth.ok)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = invoiceRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const input = parsed.data;
  const db = auth.service;

  const venueId = await resolveVenueId(
    auth,
    (body as { venue_slug?: string } | null)?.venue_slug,
  );
  if (!venueId)
    return NextResponse.json({ error: "No venue access" }, { status: 403 });

  let clientId = input.client_id ?? null;
  if (!clientId && input.new_client) {
    const { data: created, error: clientErr } = await db
      .from("clients")
      .insert({
        ...input.new_client,
        email: input.new_client.email || null,
        venue_id: venueId,
        created_by: auth.userId,
      })
      .select("id")
      .single();
    if (clientErr || !created) {
      return NextResponse.json(
        { error: clientErr?.message ?? "Nepodařilo se vytvořit klienta" },
        { status: 500 },
      );
    }
    clientId = created.id;
  }
  if (!clientId) {
    return NextResponse.json(
      { error: "client_id nebo new_client je povinný" },
      { status: 400 },
    );
  }

  // VS se v konceptu negeneruje automaticky — zůstává prázdné, dokud ho
  // uživatel nezadá (nejpozději při označení faktury jako vystavené).
  const vs =
    input.variable_symbol && input.variable_symbol.trim().length > 0
      ? input.variable_symbol.trim()
      : null;

  const { data: invoice, error: invErr } = await db
    .from("invoice_requests")
    .insert({
      client_id: clientId,
      venue_id: venueId,
      status: "draft",
      issued_at: input.issued_at ?? new Date().toISOString().slice(0, 10),
      due_date: input.due_date ?? null,
      variable_symbol: vs,
      payment_method: input.payment_method ?? "fakturace",
      short_description: input.short_description ?? null,
      notes: input.notes ?? null,
      source: input.source ?? "manual",
      source_reference: input.source_reference ?? null,
      source_metadata: input.source_metadata ?? null,
      created_by: auth.userId,
    })
    .select("*")
    .single();
  if (invErr || !invoice) {
    return NextResponse.json(
      { error: invErr?.message ?? "Nepodařilo se vytvořit fakturu" },
      { status: 500 },
    );
  }

  const itemsRows = input.items.map((it, idx) => ({
    invoice_request_id: invoice.id,
    description: it.description,
    quantity: it.quantity,
    unit_price_no_vat: it.unit_price_no_vat,
    vat_rate: it.vat_rate,
    order_index: idx,
  }));
  const { error: itemsErr } = await db.from("invoice_items").insert(itemsRows);
  if (itemsErr) {
    await db.from("invoice_requests").delete().eq("id", invoice.id);
    return NextResponse.json({ error: itemsErr.message }, { status: 500 });
  }

  const url = `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/invoices/${invoice.id}`;
  return NextResponse.json({ id: invoice.id, url }, { status: 201 });
}
