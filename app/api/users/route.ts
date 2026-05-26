import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET() {
  // Auth check — jen přihlášený uživatel může vidět seznam
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Admin API přes service role klíč
  const admin = createServiceClient();
  const { data, error } = await admin.auth.admin.listUsers();
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  const users = (data.users ?? [])
    .map((u) => ({
      id: u.id,
      email: u.email,
      created_at: u.created_at,
      last_sign_in_at: u.last_sign_in_at,
    }))
    .sort((a, b) => {
      const aTime = a.last_sign_in_at
        ? new Date(a.last_sign_in_at).getTime()
        : 0;
      const bTime = b.last_sign_in_at
        ? new Date(b.last_sign_in_at).getTime()
        : 0;
      return bTime - aTime;
    });

  return NextResponse.json({ users });
}
