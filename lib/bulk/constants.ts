// Sdílené konstanty a typy pro hromadné akce nad seznamy faktur.
// Bezpečné importovat na serveru i v klientu (žádné runtime závislosti).

export type BulkAction = "archive" | "mark_paid";

/** Maximální počet faktur v jednom hromadném volání. */
export const BULK_MAX_IDS = 200;

export type BulkSkipReason =
  | "cancelled"
  | "invalid_transition"
  | "already_archived"
  | "already_paid"
  | "not_found";

export interface BulkSkip {
  id: string;
  reason: BulkSkipReason;
}

export interface BulkResult {
  /** Počet faktur, u kterých se akce reálně provedla. */
  processed: number;
  /** Faktury, které se přeskočily, i s důvodem. */
  skipped: BulkSkip[];
}

/** Lidsky čitelné důvody přeskočení (pro UI). */
export const BULK_SKIP_REASON_LABELS: Record<BulkSkipReason, string> = {
  cancelled: "Zrušená faktura – nearchivuje se",
  invalid_transition: "Stav neumožňuje tuto akci",
  already_archived: "Už je archivovaná",
  already_paid: "Už je zaplacená",
  not_found: "Není v aktivní provozovně",
};
