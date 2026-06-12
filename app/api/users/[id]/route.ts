import { NextResponse, type NextRequest } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/venues/is-admin";
import { updateUserSchema } from "@/lib/users/types";
import { assignVenues } from "../route";

export const runtime = "nodejs";

// PATCH — update emailu, isAdmin a venue přístupů (jen admin)
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
  const parsed = updateUserSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json(
      { error: "Neplatný vstup", details: parsed.error.flatten() },
      { status: 400 },
    );

  const { email, isAdmin: makeAdmin, venues } = parsed.data;

  // Self-lockout guard: admin si nesmí odebrat všechny přístupy.
  if (user.id === id && !makeAdmin && venues.length === 0)
    return NextResponse.json(
      { error: "Nelze odebrat sám sobě všechny přístupy" },
      { status: 400 },
    );

  const admin = createServiceClient();

  // 1) Změna emailu (jen pokud se liší) — zachovej auto-confirm
  const { data: current } = await admin.auth.admin.getUserById(id);
  if (!current.user)
    return NextResponse.json(
      { error: "Uživatel nenalezen" },
      { status: 404 },
    );

  let emailChanged = false;
  if (current.user.email !== email) {
    const { error: updErr } = await admin.auth.admin.updateUserById(id, {
      email,
      email_confirm: true,
    });
    if (updErr)
      return NextResponse.json({ error: updErr.message }, { status: 400 });
    emailChanged = true;
  }

  // 2) Přepiš venue přiřazení — smaž stará, vlož nová
  const { error: delErr } = await admin
    .from("user_venues")
    .delete()
    .eq("user_id", id);
  if (delErr)
    return NextResponse.json({ error: delErr.message }, { status: 500 });

  const linkErr = await assignVenues(admin, id, makeAdmin, venues);
  if (linkErr)
    return NextResponse.json({ error: linkErr }, { status: 500 });

  return NextResponse.json({ ok: true, emailChanged });
}

// DELETE — smazat uživatele (cascade smaže user_venues) (jen admin, ne sebe)
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

  // Self-destruct guard
  if (user.id === id)
    return NextResponse.json(
      { error: "Nelze smazat sám sebe" },
      { status: 400 },
    );

  const admin = createServiceClient();
  const { error } = await admin.auth.admin.deleteUser(id);
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  return new NextResponse(null, { status: 204 });
}
