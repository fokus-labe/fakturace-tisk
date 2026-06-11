import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/venues/is-admin";

export const runtime = "nodejs";

const upsertSchema = z.object({
  user_id: z.string().uuid(),
  venue_id: z.string().uuid(),
  role: z.enum(["manager", "viewer", "admin"]),
});

// GET — všechna přiřazení (jen admin)
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await isAdmin()))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data, error } = await supabase
    .from("user_venues")
    .select("user_id, venue_id, role");
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

// POST — přidat / změnit roli (upsert na user_id+venue_id)
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await isAdmin()))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => null);
  const parsed = upsertSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 },
    );

  const { data, error } = await supabase
    .from("user_venues")
    .upsert(parsed.data, { onConflict: "user_id,venue_id" })
    .select("user_id, venue_id, role")
    .single();
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

// DELETE — odebrat přístup (?user_id=&venue_id=)
export async function DELETE(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await isAdmin()))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("user_id");
  const venueId = searchParams.get("venue_id");
  if (!userId || !venueId)
    return NextResponse.json(
      { error: "user_id a venue_id jsou povinné" },
      { status: 400 },
    );

  const { error } = await supabase
    .from("user_venues")
    .delete()
    .eq("user_id", userId)
    .eq("venue_id", venueId);
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return new NextResponse(null, { status: 204 });
}
