import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export type VenueRole = "manager" | "viewer" | "admin";

export const DEFAULT_VENUE_SLUG = "fokus-tisk";

export type Venue = {
  id: string;
  slug: string;
  name: string;
  legal_name: string;
  ico: string;
  dic: string | null;
  address_street: string | null;
  address_city: string | null;
  address_zip: string | null;
  address_country: string;
  email: string | null;
  phone: string | null;
  bank_account: string | null;
  iban: string | null;
  data_box: string | null;
  logo_url: string | null;
  brand_color: string;
  active: boolean;
};

export type UserVenue = Venue & {
  role: VenueRole;
};

/**
 * Vrátí všechny venues, ke kterým má aktuální user přístup.
 * Řazení: fokus-tisk první (stabilní default), pak abecedně.
 */
export async function getUserVenues(): Promise<UserVenue[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("user_venues")
    .select("role, venue:venues(*)")
    .eq("user_id", user.id);

  if (error || !data) return [];

  const venues = (data as Array<{ role: VenueRole; venue: Venue | Venue[] | null }>)
    .map((row) => {
      // Supabase může vrátit embedded relaci jako objekt nebo pole — normalizuj.
      const venue = Array.isArray(row.venue) ? row.venue[0] : row.venue;
      return venue ? ({ ...venue, role: row.role } as UserVenue) : null;
    })
    .filter((v): v is UserVenue => v !== null);

  venues.sort((a, b) => {
    if (a.slug === DEFAULT_VENUE_SLUG) return -1;
    if (b.slug === DEFAULT_VENUE_SLUG) return 1;
    return a.name.localeCompare(b.name, "cs");
  });

  return venues;
}

/**
 * Vrátí aktivní venue podle ?venue=slug query param, jinak default (fokus-tisk,
 * případně první dostupná). Vrací null pokud user nemá přístup k žádné venue.
 */
export async function getActiveVenue(
  searchParamSlug?: string,
): Promise<UserVenue | null> {
  const venues = await getUserVenues();
  if (venues.length === 0) return null;

  // 1. Explicitní výběr přes query param
  if (searchParamSlug) {
    const fromParam = venues.find((v) => v.slug === searchParamSlug);
    if (fromParam) return fromParam;
  }

  // 2. TODO (Sezení P2): persist přes cookie

  // 3. Default — fokus-tisk, jinak první dostupná
  return (
    venues.find((v) => v.slug === DEFAULT_VENUE_SLUG) ?? venues[0]
  );
}

/**
 * Helper pro server komponenty — z URL searchParams získá active venue.
 */
export async function resolveActiveVenue(searchParams: {
  venue?: string;
}): Promise<UserVenue | null> {
  return getActiveVenue(searchParams.venue);
}

/**
 * Resolve venue id podle slugu pomocí libovolného Supabase klienta.
 * Použití pro ne-uživatelské kontexty (API key / service client), kde
 * auth.uid() není k dispozici. Default: fokus-tisk.
 */
export async function getVenueIdBySlug(
  db: SupabaseClient,
  slug: string = DEFAULT_VENUE_SLUG,
): Promise<string | null> {
  const { data } = await db
    .from("venues")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  return data?.id ?? null;
}
