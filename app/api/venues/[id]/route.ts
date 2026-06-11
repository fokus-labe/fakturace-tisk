import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/venues/is-admin";
import { venueUpdateSchema } from "@/lib/validations/venue";

export const runtime = "nodejs";

function emptyToNull<T extends Record<string, unknown>>(obj: T): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    out[k] = v === "" ? null : v;
  }
  return out as T;
}

// Tabulky s venue_id, které brání smazání provozovny
const VENUE_FK_TABLES = [
  "invoice_requests",
  "received_invoices",
  "clients",
  "suppliers",
  "etn_exports",
  "invoice_imports",
] as const;

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!(await isAdmin()))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => null);
  const parsed = venueUpdateSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 },
    );

  const patch = emptyToNull({ ...parsed.data });

  const { data, error } = await supabase
    .from("venues")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();
  if (error) {
    const status = error.code === "23505" ? 409 : 500;
    return NextResponse.json({ error: error.message }, { status });
  }
  return NextResponse.json({ data });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!(await isAdmin()))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Ochrana proti smazání provozovny s navázanými daty
  for (const table of VENUE_FK_TABLES) {
    const { count, error: countErr } = await supabase
      .from(table)
      .select("id", { count: "exact", head: true })
      .eq("venue_id", id);
    if (countErr)
      return NextResponse.json({ error: countErr.message }, { status: 500 });
    if ((count ?? 0) > 0) {
      return NextResponse.json(
        {
          error: `Provozovna má navázaná data (${table}: ${count}), nelze smazat. Místo mazání ji deaktivuj.`,
        },
        { status: 409 },
      );
    }
  }

  const { error } = await supabase.from("venues").delete().eq("id", id);
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return new NextResponse(null, { status: 204 });
}
