import { NextResponse, type NextRequest } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (id) {
    const { data, error } = await supabase
      .from("invoice_imports")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error)
      return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const email = await resolveEmail(data.imported_by);
    return NextResponse.json({ import: { ...data, user_email: email } });
  }

  const { data, error } = await supabase
    .from("invoice_imports")
    .select("*")
    .order("imported_at", { ascending: false })
    .limit(50);

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = data ?? [];
  const userIds = Array.from(
    new Set(rows.map((r) => r.imported_by).filter((x): x is string => !!x)),
  );

  let emailById = new Map<string, string>();
  if (userIds.length > 0) {
    try {
      const admin = createServiceClient();
      const { data: usersList } = await admin.auth.admin.listUsers();
      emailById = new Map(
        (usersList?.users ?? [])
          .filter((u) => userIds.includes(u.id))
          .map((u) => [u.id, u.email ?? ""]),
      );
    } catch (err) {
      console.warn("[import/history] failed to resolve emails:", err);
    }
  }

  const imports = rows.map((r) => ({
    ...r,
    user_email: r.imported_by ? (emailById.get(r.imported_by) ?? null) : null,
  }));

  return NextResponse.json({ imports });
}

async function resolveEmail(userId: string | null): Promise<string | null> {
  if (!userId) return null;
  try {
    const admin = createServiceClient();
    const { data } = await admin.auth.admin.getUserById(userId);
    return data?.user?.email ?? null;
  } catch {
    return null;
  }
}
