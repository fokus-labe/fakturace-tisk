import { NextResponse, type NextRequest } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/venues/is-admin";
import { resetPasswordSchema } from "@/lib/users/types";

export const runtime = "nodejs";

// POST — reset hesla. Nové heslo přijde z klienta, backend ho jen nastaví.
// Po resetu jsou existující sessions usera zneplatněné (Supabase to řeší sám).
export async function POST(
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
  const parsed = resetPasswordSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json(
      { error: "Neplatné heslo (min. 8 znaků)" },
      { status: 400 },
    );

  const admin = createServiceClient();
  const { error } = await admin.auth.admin.updateUserById(id, {
    password: parsed.data.password,
  });
  if (error)
    return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
