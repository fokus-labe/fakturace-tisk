import { createServerClient } from "@supabase/ssr";
import { createClient as createServiceJsClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Server Components cannot set cookies; middleware refreshes the session.
          }
        },
      },
    },
  );
}

// Service-role klient (obchází RLS) — server-only. Statický import je bez rizika:
// @supabase/ssr (cookie klient výše) už @supabase/supabase-js do bundlu stahuje,
// takže dřívější lazy require() nešetřil nic; require() jen porušoval lint.
export function createServiceClient() {
  return createServiceJsClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
