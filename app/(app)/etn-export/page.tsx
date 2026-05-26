import { FileSpreadsheet } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = { title: "ETN Export · Fokus tisk" };

export default function EtnExportPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">ETN Export</h1>
        <p className="text-sm text-muted-foreground">
          Export podkladů pro účetní Petra Čálka.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileSpreadsheet className="size-4" />
            Modul v přípravě
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Modul ETN Export bude implementován v další fázi (Sezení B).
        </CardContent>
      </Card>
    </div>
  );
}
