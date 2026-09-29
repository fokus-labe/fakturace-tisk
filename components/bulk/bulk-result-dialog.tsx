"use client";

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { BULK_SKIP_REASON_LABELS, type BulkSkipReason } from "@/lib/bulk/constants";

export interface SkippedRow {
  label: string;
  reason: BulkSkipReason;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  processed: number;
  skipped: SkippedRow[];
}

/** Výsledek hromadné akce — kolik se zpracovalo a které faktury se přeskočily a proč. */
export function BulkResultDialog({
  open,
  onOpenChange,
  title,
  processed,
  skipped,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <p>
            Zpracováno: <strong>{processed}</strong> · Přeskočeno:{" "}
            <strong>{skipped.length}</strong>
          </p>
          {skipped.length > 0 ? (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">
                Přeskočené faktury a důvod:
              </p>
              <div className="max-h-64 divide-y overflow-auto rounded-md border">
                {skipped.map((s, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between gap-3 px-3 py-1.5"
                  >
                    <span className="truncate">{s.label}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {BULK_SKIP_REASON_LABELS[s.reason]}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Zavřít</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
