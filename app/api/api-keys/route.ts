import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { generateApiKey, hashApiKey } from "@/lib/auth/api-key";

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

  const { data, error } = await supabase
    .from("api_keys")
    .select("id, name, key_prefix, scopes, created_at, last_used_at, revoked_at")
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

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const { key, prefix } = generateApiKey();
  const keyHash = await hashApiKey(key);

  const { data, error } = await supabase
    .from("api_keys")
    .insert({
      name: parsed.data.name,
      key_hash: keyHash,
      key_prefix: prefix,
      scopes: parsed.data.scopes ?? [],
      created_by: user.id,
    })
    .select("id, name, key_prefix, scopes, created_at")
    .single();
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ data: { ...data, key } }, { status: 201 });
}
