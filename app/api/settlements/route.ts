import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getActiveVenue } from "@/lib/venues/get-user-venues";
import {
  deriveCost,
  deriveRevenue,
  isSettlementSumOk,
  settlementShortDescription,
  settlementSumDiff,
  SETTLEMENT_PROVIDERS,
  type SettlementProvider,
} from "@/lib/settlements/compute";

export const runtime = "nodejs";

const BodySchema = z.object({
  provider: z.enum(SETTLEMENT_PROVIDERS as [SettlementProvider, ...SettlementProvider[]]),
  statement_number: z.string().trim().min(1),
  statement_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  gross_amount: z.coerce.number(),
  fee_amount: z.coerce.number(),
  net_amount: z.coerce.number(),
  // odběratel tržby — povinný jen když tržba vzniká (brutto > 0)
  client_id: z.string().uuid().optional().nullable(),
  venue_slug: z.string().optional(),
});

async function resolveCostSupplierId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  venueId: string,
  userId: string,
  supplier: { name: string; ico: string },
): Promise<string> {
  // Dedup v rámci provozovny: nejdřív podle IČO, pak podle názvu.
  const byIco = await supabase
    .from("suppliers")
    .select("id")
    .eq("venue_id", venueId)
    .eq("ico", supplier.ico)
    .maybeSingle();
  if (byIco.data) return byIco.data.id;

  const byName = await supabase
    .from("suppliers")
    .select("id")
    .eq("venue_id", venueId)
    .eq("name", supplier.name)
    .maybeSingle();
  if (byName.data) return byName.data.id;

  const { data: created, error } = await supabase
    .from("suppliers")
    .insert({
      name: supplier.name,
      ico: supplier.ico,
      venue_id: venueId,
      default_category: "sluzby",
      default_payment_method: "faktura",
      created_by: userId,
    })
    .select("id")
    .single();
  if (error || !created)
    throw new Error(error?.message ?? "Nepodařilo se vytvořit dodavatele");
  return created.id;
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json(
      { error: "Invalid input", issues: parsed.error.issues },
      { status: 400 },
    );

  const input = parsed.data;
  const amounts = {
    gross: input.gross_amount,
    fee: input.fee_amount,
    net: input.net_amount,
  };

  // Kontrola součtu — hlavní důvod funkce, NEobejitelná.
  if (!isSettlementSumOk(amounts)) {
    return NextResponse.json(
      {
        error: "Kontrola součtu neprošla: brutto − poplatek se nerovná netto.",
        sum_check: {
          gross: amounts.gross,
          fee: amounts.fee,
          net: amounts.net,
          diff: settlementSumDiff(amounts),
        },
      },
      { status: 400 },
    );
  }

  const venue = await getActiveVenue(input.venue_slug);
  if (!venue)
    return NextResponse.json({ error: "No venue access" }, { status: 403 });

  const cost = deriveCost(input.provider, amounts);
  const revenue = deriveRevenue(amounts);
  const shortDescription = settlementShortDescription(
    input.provider,
    input.statement_number,
  );

  // Odběratel tržby: povinný, když tržba vzniká.
  let revenueClientId: string | null = null;
  if (revenue) {
    if (!input.client_id)
      return NextResponse.json(
        { error: "U tržby je povinný odběratel — vyber ho v náhledu." },
        { status: 400 },
      );
    const { data: client } = await supabase
      .from("clients")
      .select("id")
      .eq("venue_id", venue.id)
      .eq("id", input.client_id)
      .maybeSingle();
    if (!client)
      return NextResponse.json(
        { error: "Vybraný odběratel nepatří do aktivní provozovny." },
        { status: 400 },
      );
    revenueClientId = client.id;
  }

  let costSupplierId: string;
  try {
    costSupplierId = await resolveCostSupplierId(
      supabase,
      venue.id,
      user.id,
      cost.supplier,
    );
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Dodavatele se nepodařilo připravit" },
      { status: 500 },
    );
  }

  const { data: rpcData, error: rpcErr } = await supabase.rpc(
    "create_settlement_with_records",
    {
      p_venue_id: venue.id,
      p_provider: input.provider,
      p_statement_number: input.statement_number,
      p_statement_date: input.statement_date,
      p_gross: amounts.gross,
      p_fee: amounts.fee,
      p_net: amounts.net,
      p_created_by: user.id,
      p_short_description: shortDescription,
      p_cost_supplier_id: costSupplierId,
      p_cost_no_vat: cost.amount_no_vat,
      p_cost_vat: cost.amount_vat,
      p_cost_total: cost.amount_total,
      p_revenue_client_id: revenueClientId,
      p_revenue_no_vat: revenue?.amount_no_vat ?? 0,
    },
  );

  if (rpcErr) {
    // Unikátní index (venue_id, statement_number) → výpis už zaevidovaný.
    if (rpcErr.code === "23505") {
      const { data: existing } = await supabase
        .from("settlements")
        .select("id")
        .eq("venue_id", venue.id)
        .eq("statement_number", input.statement_number)
        .maybeSingle();
      const { data: existingReceived } = existing
        ? await supabase
            .from("received_invoices")
            .select("id")
            .eq("settlement_id", existing.id)
            .maybeSingle()
        : { data: null };
      return NextResponse.json(
        {
          error: `Výpis „${input.statement_number}" je už zaevidovaný.`,
          existing: {
            settlement_id: existing?.id ?? null,
            received_id: existingReceived?.id ?? null,
          },
        },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: rpcErr.message }, { status: 500 });
  }

  const result = rpcData as {
    settlement_id: string;
    received_id: string;
    issued_id: string | null;
  };

  return NextResponse.json(result, { status: 201 });
}
