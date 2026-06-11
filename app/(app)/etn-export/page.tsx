import { Upload } from "lucide-react";
import { EtnExportClient } from "./etn-export-client";
import { VenueBreadcrumb } from "@/components/venue/venue-breadcrumb";

export const metadata = { title: "ETN Export · Fokus tisk" };

export default function EtnExportPage() {
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

      <EtnExportClient />
    </div>
  );
}
