import { History, Upload } from "lucide-react";
import { EtnExportClient } from "./etn-export-client";
import { VenueBreadcrumb } from "@/components/venue/venue-breadcrumb";
import { getActiveVenue, getUserVenues } from "@/lib/venues/get-user-venues";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils/format";

export const metadata = { title: "ETN Export · Fokus tisk" };

export default async function EtnExportPage() {
  const [venue, venues] = await Promise.all([
    getActiveVenue(),
    getUserVenues(),
  ]);
  const multiVenue = venues.length > 1;

  let lastExport:
    | {
        period_start: string;
        period_end: string;
        exported_at: string;
        invoice_count_received: number;
        invoice_count_issued: number;
      }
    | null = null;
  if (venue) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("etn_exports")
      .select(
        "period_start, period_end, exported_at, invoice_count_received, invoice_count_issued",
      )
      .eq("venue_id", venue.id)
      .order("exported_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    lastExport = data ?? null;
  }

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

      <div className="rounded-md border bg-muted/30 p-3 text-sm">
        <div className="flex items-center gap-2 font-medium">
          <History className="size-4 text-muted-foreground" />
          Poslední export
        </div>
        {lastExport ? (
          <p className="mt-1 text-muted-foreground">
            Období{" "}
            <strong className="text-foreground">
              {formatDate(lastExport.period_start)} –{" "}
              {formatDate(lastExport.period_end)}
            </strong>
            , vytvořen {formatDate(lastExport.exported_at)} ·{" "}
            {lastExport.invoice_count_received} nákladů,{" "}
            {lastExport.invoice_count_issued} tržeb. Tady se naposledy skončilo.
          </p>
        ) : (
          <p className="mt-1 text-muted-foreground">
            Pro tuto provozovnu zatím žádný export.
          </p>
        )}
      </div>

      <EtnExportClient />
    </div>
  );
}
