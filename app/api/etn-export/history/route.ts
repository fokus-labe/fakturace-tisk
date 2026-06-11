import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getActiveVenue } from "@/lib/venues/get-user-venues";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const venue = await getActiveVenue(searchParams.get("venue") ?? undefined);
  if (!venue)
    return NextResponse.json({ error: "No venue access" }, { status: 403 });

  const { data, error } = await supabase
    .from("etn_exports")
    .select("*")
    .eq("venue_id", venue.id)
    .order("exported_at", { ascending: false })
    .limit(100);
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ exports: data ?? [] });
}
