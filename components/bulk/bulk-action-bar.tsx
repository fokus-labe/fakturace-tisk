"use client";

import { Archive, Check, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  count: number;
  pending: boolean;
  markPaidLabel: string;
  onClear: () => void;
  onArchive: () => void;
  onMarkPaid: () => void;
}

/**
 * Lišta hromadných akcí nad tabulkou. Zobrazí se jen když je něco vybráno a
 * zůstává přilepená pod hlavičkou aplikace i při scrollování (`sticky top-14`).
 */
export function BulkActionBar({
  count,
  pending,
  markPaidLabel,
  onClear,
  onArchive,
  onMarkPaid,
}: Props) {
  if (count === 0) return null;

  return (
    <div className="sticky top-14 z-20 flex flex-wrap items-center gap-2 rounded-lg border bg-card px-3 py-2 shadow-sm">
      <span className="text-sm font-medium">Vybráno: {count}</span>
      <Button
        variant="ghost"
        size="sm"
        onClick={onClear}
        disabled={pending}
        className="text-muted-foreground hover:text-foreground"
      >
        <X className="mr-1 size-4" />
        Zrušit výběr
      </Button>
      <div className="flex-1" />
      <Button
        variant="outline"
        size="sm"
        onClick={onArchive}
        disabled={pending}
      >
        {pending ? (
          <Loader2 className="mr-2 size-4 animate-spin" />
        ) : (
          <Archive className="mr-2 size-4" />
        )}
        Archivovat
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={onMarkPaid}
        disabled={pending}
      >
        <Check className="mr-2 size-4" />
        {markPaidLabel}
      </Button>
    </div>
  );
}
