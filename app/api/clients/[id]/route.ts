import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { clientSchema } from "@/lib/validations/client";

export const runtime = "nodejs";

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

  const body = await req.json().catch(() => null);
  const parsed = clientSchema.partial().safeParse(body);
  if (!parsed.success)
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 },
    );

  const patch = { ...parsed.data, email: parsed.data.email || null };

  const { data, error } = await supabase
    .from("clients")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
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

  // Zkontroluj, jestli má klient nějaké faktury
  const { count, error: countErr } = await supabase
    .from("invoice_requests")
    .select("id", { count: "exact", head: true })
    .eq("client_id", id);
  if (countErr)
    return NextResponse.json({ error: countErr.message }, { status: 500 });

  if ((count ?? 0) > 0) {
    return NextResponse.json(
      {
        error: `Klient má ${count} faktur, nelze smazat. Nejprve smaž faktury.`,
        count,
      },
      { status: 409 },
    );
  }

  const { error } = await supabase.from("clients").delete().eq("id", id);
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  return new NextResponse(null, { status: 204 });
}
