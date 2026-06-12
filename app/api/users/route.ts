import { NextResponse, type NextRequest } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/venues/is-admin";
import { createUserSchema, type UserRow } from "@/lib/users/types";

export const runtime = "nodejs";

// GET — seznam uživatelů + jejich venue přístupy + last login (jen admin)
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await isAdmin()))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const admin = createServiceClient();

  const [{ data: authData, error: authErr }, { data: venues }, { data: links }] =
    await Promise.all([
      admin.auth.admin.listUsers(),
      admin.from("venues").select("id, slug, name").order("name"),
      admin.from("user_venues").select("user_id, venue_id, role"),
    ]);

  if (authErr)
    return NextResponse.json({ error: authErr.message }, { status: 500 });

  const venueById = new Map(
    (venues ?? []).map((v) => [v.id, { slug: v.slug, name: v.name }]),
  );
  const venueCount = venues?.length ?? 0;

  const rows: UserRow[] = (authData.users ?? [])
    .map((u) => {
      const access = (links ?? [])
        .filter((l) => l.user_id === u.id)
        .map((l) => {
          const v = venueById.get(l.venue_id);
          return v ? { slug: v.slug, name: v.name, role: l.role } : null;
        })
        .filter((a): a is NonNullable<typeof a> => a !== null);
      const adminAll =
        venueCount > 0 &&
        access.length === venueCount &&
        access.every((a) => a.role === "admin");
      return {
        id: u.id,
        email: u.email ?? null,
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at ?? null,
        isAdmin: adminAll,
        access,
      };
    })
    .sort((a, b) => {
      const at = a.last_sign_in_at ? new Date(a.last_sign_in_at).getTime() : 0;
      const bt = b.last_sign_in_at ? new Date(b.last_sign_in_at).getTime() : 0;
      return bt - at;
    });

  return NextResponse.json({ users: rows });
}

// POST — vytvořit uživatele (email, password, isAdmin, venues[]) (jen admin)
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
  const parsed = createUserSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json(
      { error: "Neplatný vstup", details: parsed.error.flatten() },
      { status: 400 },
    );

  const { email, password, isAdmin: makeAdmin, venues } = parsed.data;
  const admin = createServiceClient();

  // 1) Vytvoř usera (auto-confirm — bez email verification)
  const { data: created, error: createErr } =
    await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
  if (createErr || !created.user)
    return NextResponse.json(
      { error: createErr?.message ?? "Vytvoření selhalo" },
      { status: 400 },
    );

  const userId = created.user.id;

  // 2) Sestav venue přiřazení
  const linkErr = await assignVenues(admin, userId, makeAdmin, venues);
  if (linkErr) {
    // Rollback — smaž usera, ať nezůstane v půlce
    await admin.auth.admin.deleteUser(userId);
    return NextResponse.json({ error: linkErr }, { status: 500 });
  }

  return NextResponse.json({
    user: { id: userId, email: created.user.email },
  });
}

// Sdílený helper: nastaví user_venues podle isAdmin / venues[].
// Vrací error string nebo null.
export async function assignVenues(
  admin: ReturnType<typeof createServiceClient>,
  userId: string,
  makeAdmin: boolean,
  venues: { slug: string; role: "manager" | "viewer" }[],
): Promise<string | null> {
  // Načti všechny venues pro slug → id mapping
  const { data: allVenues, error: venuesErr } = await admin
    .from("venues")
    .select("id, slug");
  if (venuesErr) return venuesErr.message;

  const idBySlug = new Map((allVenues ?? []).map((v) => [v.slug, v.id]));

  let rows: { user_id: string; venue_id: string; role: string }[];
  if (makeAdmin) {
    // Admin → role 'admin' ve VŠECH venues
    rows = (allVenues ?? []).map((v) => ({
      user_id: userId,
      venue_id: v.id,
      role: "admin",
    }));
  } else {
    rows = venues
      .map((v) => {
        const venueId = idBySlug.get(v.slug);
        return venueId
          ? { user_id: userId, venue_id: venueId, role: v.role }
          : null;
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);
  }

  if (rows.length === 0) return null;

  const { error } = await admin
    .from("user_venues")
    .upsert(rows, { onConflict: "user_id,venue_id" });
  return error?.message ?? null;
}
