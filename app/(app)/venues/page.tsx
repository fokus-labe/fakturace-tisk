import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/venues/is-admin";
import type { Venue } from "@/lib/venues/get-user-venues";
import { VenuesClient } from "./venues-client";

export const metadata = { title: "Provozovny" };

export default async function VenuesPage() {
  if (!(await isAdmin())) redirect("/");

  const supabase = await createClient();
  const { data } = await supabase
    .from("venues")
    .select("*")
    .order("name", { ascending: true });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Provozovny</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Správa provozoven Fokus Labe — vystavovatel, kontakt, banka, branding.
        </p>
      </div>
      <VenuesClient initialVenues={(data ?? []) as Venue[]} />
    </div>
  );
}
