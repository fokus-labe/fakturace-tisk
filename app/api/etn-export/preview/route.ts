import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchEtnCandidates } from "@/lib/etn/fetch-selection-data";
import { ETN_MAX_ISSUED, ETN_MAX_RECEIVED } from "@/lib/etn/limits";
import { getActiveVenue } from "@/lib/venues/get-user-venues";

export const runtime = "nodejs";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const periodStart = searchParams.get("periodStart") ?? "";
  const periodEnd = searchParams.get("periodEnd") ?? "";

  if (!DATE_RE.test(periodStart) || !DATE_RE.test(periodEnd))
    return NextResponse.json(
      { error: "Invalid period (YYYY-MM-DD)" },
      { status: 400 },
    );

  const venue = await getActiveVenue(searchParams.get("venue") ?? undefined);
  if (!venue)
    return NextResponse.json({ error: "No venue access" }, { status: 403 });

  try {
    const data = await fetchEtnCandidates(
      supabase,
      venue.id,
      periodStart,
      periodEnd,
    );
    return NextResponse.json({
      periodStart,
      periodEnd,
      issued: data.issued,
      received: data.received,
      limits: { maxReceived: ETN_MAX_RECEIVED, maxIssued: ETN_MAX_ISSUED },
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Načtení dat selhalo" },
      { status: 500 },
    );
  }
}
