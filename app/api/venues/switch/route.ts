import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { setActiveVenueCookie } from "@/lib/venues/cookie";
import { getUserVenues } from "@/lib/venues/get-user-venues";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const slug = body?.slug;
  if (!slug || typeof slug !== "string") {
    return NextResponse.json({ error: "Invalid slug" }, { status: 400 });
  }

  // Ověř, že user má přístup k této venue
  const userVenues = await getUserVenues();
  const targetVenue = userVenues.find((v) => v.slug === slug);
  if (!targetVenue) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await setActiveVenueCookie(slug);
  return NextResponse.json({ success: true, venue: targetVenue });
}
