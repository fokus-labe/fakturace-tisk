import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchEtnPeriodData } from "@/lib/etn/fetch-period-data";
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
    const data = await fetchEtnPeriodData(
      supabase,
      periodStart,
      periodEnd,
      venue.id,
    );
    return NextResponse.json({
      periodStart,
      periodEnd,
      receivedInvoices: data.receivedInvoices.map((r) => ({
        ...r,
        issued_at: r.issued_at.toISOString().slice(0, 10),
      })),
      issuedInvoices: data.issuedInvoices.map((r) => ({
        ...r,
        issued_at: r.issued_at.toISOString().slice(0, 10),
      })),
      warnings: data.warnings,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Načtení dat selhalo" },
      { status: 500 },
    );
  }
}
