import { createClient } from "@/lib/supabase/server";

/**
 * Vrátí true pokud má aktuální user roli 'admin' v JAKÉKOLI provozovně.
 */
export async function isAdmin(): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  const { data } = await supabase
    .from("user_venues")
    .select("role")
    .eq("user_id", user.id)
    .eq("role", "admin")
    .limit(1);

  return (data?.length ?? 0) > 0;
}
