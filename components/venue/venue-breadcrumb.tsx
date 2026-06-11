import { getActiveVenue } from "@/lib/venues/get-user-venues";

/**
 * Šedý "breadcrumb" s názvem aktivní provozovny nad H1 listing stránek.
 * Async server komponenta — sama si načte aktivní venue (z cookie/query/default).
 */
export async function VenueBreadcrumb() {
  const venue = await getActiveVenue();
  if (!venue) return null;

  return (
    <div className="mb-1 text-sm font-medium text-muted-foreground">
      {venue.name}
    </div>
  );
}
