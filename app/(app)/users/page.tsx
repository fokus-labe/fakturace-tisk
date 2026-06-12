import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/venues/is-admin";
import type { UserRow, VenueLite } from "@/lib/users/types";
import { UsersClient } from "./users-client";

export const metadata = { title: "Uživatelé" };

export default async function UsersPage() {
  if (!(await isAdmin())) redirect("/");

  const supabase = await createClient();
  const {
    data: { user: currentUser },
  } = await supabase.auth.getUser();

  const admin = createServiceClient();
  const [authRes, venuesRes, linksRes] = await Promise.all([
    admin.auth.admin.listUsers(),
    admin.from("venues").select("id, slug, name").order("name"),
    admin.from("user_venues").select("user_id, venue_id, role"),
  ]);

  const venues: VenueLite[] = (venuesRes.data ?? []).map((v) => ({
    id: v.id,
    slug: v.slug,
    name: v.name,
  }));
  const venueById = new Map(venues.map((v) => [v.id, v]));
  const links = linksRes.data ?? [];

  const users: UserRow[] = (authRes.data?.users ?? [])
    .map((u) => {
      const access = links
        .filter((l) => l.user_id === u.id)
        .map((l) => {
          const v = venueById.get(l.venue_id);
          return v ? { slug: v.slug, name: v.name, role: l.role } : null;
        })
        .filter((a): a is NonNullable<typeof a> => a !== null);
      const adminAll =
        venues.length > 0 &&
        access.length === venues.length &&
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Uživatelé</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Správa uživatelů — vytvoření, reset hesla, smazání a přístupy
          k provozovnám.
        </p>
      </div>
      <UsersClient
        initialUsers={users}
        venues={venues}
        currentUserId={currentUser?.id ?? ""}
      />
    </div>
  );
}
