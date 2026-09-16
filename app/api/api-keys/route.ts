import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { generateApiKey, hashApiKey } from "@/lib/auth/api-key";
import { isAdmin } from "@/lib/venues/is-admin";
import { getActiveVenue } from "@/lib/venues/get-user-venues";

export const runtime = "nodejs";

const bodySchema = z.object({
  name: z.string().min(1).max(100),
  scopes: z.array(z.string()).optional(),
});

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await isAdmin()))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // RLS vrací jen klíče provozoven, ke kterým má user přístup (admin vidí vše).
  const { data, error } = await supabase
    .from("api_keys")
    .select(
      "id, name, key_prefix, scopes, created_at, last_used_at, revoked_at, venue_id, venue:venues(name, slug)",
    )
    .order("created_at", { ascending: false });
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await isAdmin()))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  // Klíč patří aktuálně aktivní provozovně.
  const venue = await getActiveVenue();
  if (!venue)
    return NextResponse.json({ error: "No venue access" }, { status: 403 });

  const { key, prefix } = generateApiKey();
  const keyHash = await hashApiKey(key);

  const { data, error } = await supabase
    .from("api_keys")
    .insert({
      name: parsed.data.name,
      key_hash: keyHash,
      key_prefix: prefix,
      scopes: parsed.data.scopes ?? [],
      venue_id: venue.id,
      created_by: user.id,
    })
    .select("id, name, key_prefix, scopes, created_at, venue_id")
    .single();
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ data: { ...data, key } }, { status: 201 });
}
