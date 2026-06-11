import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { getActiveVenue, getUserVenues } from "@/lib/venues/get-user-venues";
import { isAdmin } from "@/lib/venues/is-admin";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const venues = await getUserVenues();
  if (venues.length === 0) redirect("/no-access");

  const activeVenue = await getActiveVenue();
  const admin = await isAdmin();

  const venueOptions = venues.map((v) => ({
    slug: v.slug,
    name: v.name,
    brand_color: v.brand_color,
  }));
  const activeSlug = activeVenue?.slug ?? venueOptions[0]?.slug ?? "";

  return (
    <div className="flex flex-1 min-w-0">
      <Sidebar venues={venueOptions} activeSlug={activeSlug} isAdmin={admin} />
      <div className="flex flex-1 flex-col min-w-0">
        <Header
          email={user.email ?? null}
          venues={venueOptions}
          activeSlug={activeSlug}
          isAdmin={admin}
        />
        <main className="flex-1 px-4 py-6 sm:px-6 sm:py-8 max-w-6xl w-full mx-auto min-w-0">
          {children}
        </main>
      </div>
    </div>
  );
}
