// Server-safe (bez "use client"). Odznak „odevzdáno v ETN" + odkaz do historie.
import Link from "next/link";
import { FileSpreadsheet } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/utils/format";

export interface EtnExportInfo {
  id: string;
  period_start: string;
  period_end: string;
}

/** Znormalizuj embedded relaci etn_export (Supabase vrací objekt nebo pole). */
export function etnExportInfo(rel: unknown): EtnExportInfo | null {
  const v = Array.isArray(rel) ? rel[0] : rel;
  const e = v as Partial<EtnExportInfo> | null;
  if (!e?.id || !e?.period_start || !e?.period_end) return null;
  return { id: e.id, period_start: e.period_start, period_end: e.period_end };
}

export function EtnExportBadge({
  export: info,
  asLink = false,
  className,
}: {
  export: EtnExportInfo;
  asLink?: boolean;
  className?: string;
}) {
  const cls = cn(
    "inline-flex items-center gap-1 rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-medium text-blue-800 dark:bg-blue-950/50 dark:text-blue-200",
    className,
  );
  const content = (
    <>
      <FileSpreadsheet className="size-3" />
      ETN {formatDate(info.period_start)}–{formatDate(info.period_end)}
    </>
  );
  if (asLink) {
    return (
      <Link href={`/etn-export#export-${info.id}`} className={cn(cls, "hover:bg-blue-200")}>
        {content}
      </Link>
    );
  }
  return <span className={cls}>{content}</span>;
}
