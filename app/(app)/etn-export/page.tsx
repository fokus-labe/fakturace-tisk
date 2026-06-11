import { Upload } from "lucide-react";
import { EtnExportClient } from "./etn-export-client";
import { VenueBreadcrumb } from "@/components/venue/venue-breadcrumb";
import { getActiveVenue, getUserVenues } from "@/lib/venues/get-user-venues";

export const metadata = { title: "ETN Export · Fokus tisk" };

export default async function EtnExportPage() {
  const [venue, venues] = await Promise.all([
    getActiveVenue(),
    getUserVenues(),
  ]);
  const multiVenue = venues.length > 1;

  return (
    <div className="space-y-6">
      <div>
        <VenueBreadcrumb />
        <div className="flex items-center gap-3">
          <Upload className="size-5 text-muted-foreground" />
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              ETN Export pro Petra
            </h1>
            <p className="text-sm text-muted-foreground">
              Generuj XLSX s evidencí tržeb a nákladů pro účetního.
            </p>
          </div>
        </div>
      </div>

      {venue ? (
        <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-200">
          📊 Generuješ ETN report pro provozovnu:{" "}
          <strong>{venue.name}</strong>
          {multiVenue ? (
            <span className="mt-1 block text-blue-700/80 dark:text-blue-300/80">
              Pro jinou provozovnu ji přepni v selectoru v sidebaru.
            </span>
          ) : null}
        </div>
      ) : null}

      <EtnExportClient />
    </div>
  );
}
