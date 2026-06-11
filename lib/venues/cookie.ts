import { cookies } from "next/headers";

export const VENUE_COOKIE_NAME = "active_venue_slug";
const ONE_YEAR = 60 * 60 * 24 * 365;

export async function setActiveVenueCookie(slug: string) {
  const cookieStore = await cookies();
  cookieStore.set(VENUE_COOKIE_NAME, slug, {
    maxAge: ONE_YEAR,
    httpOnly: false, // Client VenueSelector ho čte/přepisuje přes API
    sameSite: "lax",
    path: "/",
  });
}

export async function getActiveVenueCookie(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(VENUE_COOKIE_NAME)?.value ?? null;
}

export async function clearActiveVenueCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(VENUE_COOKIE_NAME);
}
