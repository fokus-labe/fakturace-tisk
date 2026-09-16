// Server-safe (bez "use client"). Odznak vyúčtování + odkaz na protistranu dvojice.
import Link from "next/link";
import { ArrowLeftRight, Landmark } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  SETTLEMENT_PROVIDER_LABELS,
  type SettlementProvider,
} from "@/lib/settlements/compute";

export interface SettlementInfo {
  id: string;
  provider: SettlementProvider;
  statement_number: string;
}

/** Znormalizuj embedded relaci settlement (Supabase vrací objekt nebo pole). */
export function settlementInfo(rel: unknown): SettlementInfo | null {
  const v = Array.isArray(rel) ? rel[0] : rel;
  const e = v as Partial<SettlementInfo> | null;
  if (!e?.id || !e?.provider || !e?.statement_number) return null;
  return {
    id: e.id,
    provider: e.provider as SettlementProvider,
    statement_number: e.statement_number,
  };
}

export function SettlementBadge({
  settlement,
  counterpartHref,
  counterpartLabel,
  className,
}: {
  settlement: SettlementInfo;
  counterpartHref?: string;
  counterpartLabel?: string;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex flex-wrap items-center gap-2", className)}>
      <span className="inline-flex items-center gap-1 rounded bg-violet-100 px-1.5 py-0.5 text-[11px] font-medium text-violet-800 dark:bg-violet-950/50 dark:text-violet-200">
        <Landmark className="size-3" />
        {SETTLEMENT_PROVIDER_LABELS[settlement.provider]} ·{" "}
        {settlement.statement_number}
      </span>
      {counterpartHref ? (
        <Link
          href={counterpartHref}
          className="inline-flex items-center gap-1 text-xs text-violet-700 hover:underline dark:text-violet-300"
        >
          <ArrowLeftRight className="size-3" />
          {counterpartLabel ?? "protistrana"}
        </Link>
      ) : null}
    </span>
  );
}
