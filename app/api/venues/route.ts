import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/venues/is-admin";
import { venueSchema } from "@/lib/validations/venue";

export const runtime = "nodejs";

function emptyToNull<T extends Record<string, unknown>>(obj: T): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    out[k] = v === "" ? null : v;
  }
  return out as T;
}

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
    .from("venues")
    .select("*")
    .order("name", { ascending: true });
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

  const body = await req.json().catch(() => null);
  const parsed = venueSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 },
    );

  const insert = emptyToNull({
    ...parsed.data,
    address_country: parsed.data.address_country || "Česká republika",
    brand_color: parsed.data.brand_color || "#2563EB",
    active: parsed.data.active ?? true,
  });

  const { data, error } = await supabase
    .from("venues")
    .insert(insert)
    .select("*")
    .single();
  if (error) {
    const status = error.code === "23505" ? 409 : 500; // unique slug
    return NextResponse.json({ error: error.message }, { status });
  }
  return NextResponse.json({ data }, { status: 201 });
}
