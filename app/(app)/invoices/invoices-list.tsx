"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SortableHeader } from "@/components/ui/sortable-header";
import { SortSelect } from "@/components/ui/sort-select";
import { InvoiceStatusBadge } from "@/components/invoice/invoice-status-badge";
import {
  EtnExportBadge,
  type EtnExportInfo,
} from "@/components/etn/etn-export-badge";
import { formatCZK, formatDate } from "@/lib/utils/format";
import { useBulkSelection } from "@/components/bulk/use-bulk-selection";
import { IndeterminateCheckbox } from "@/components/bulk/indeterminate-checkbox";
import { BulkActionBar } from "@/components/bulk/bulk-action-bar";
import { BulkConfirmDialog } from "@/components/bulk/bulk-confirm-dialog";
import {
  BulkResultDialog,
  type SkippedRow,
} from "@/components/bulk/bulk-result-dialog";
import { BULK_MAX_IDS, type BulkAction, type BulkResult } from "@/lib/bulk/constants";
import type { InvoiceStatus } from "@/types/invoice";

export interface IssuedListRow {
  id: string;
  clientName: string;
  issuedAt: string;
  dueDate: string | null;
  variableSymbol: string | null;
  paymentMethod: string | null;
  showPayment: boolean;
  totalWithVat: number;
  status: InvoiceStatus;
  etnExport: EtnExportInfo | null;
}

const MOBILE_SORT_OPTIONS = [
  { value: "issued_at|asc", label: "Datum (nejstarší)" },
  { value: "issued_at|desc", label: "Datum (nejnovější)" },
  { value: "client_name|asc", label: "Klient (A–Z)" },
  { value: "client_name|desc", label: "Klient (Z–A)" },
  { value: "total|desc", label: "Částka (od nejvyšší)" },
  { value: "total|asc", label: "Částka (od nejnižší)" },
  { value: "due_date|asc", label: "Splatnost (nejstarší)" },
];

const MARK_PAID_LABEL = "Označit jako uhrazené";

interface Props {
  rows: IssuedListRow[];
  selectionKey: string;
}

export function InvoicesList({ rows, selectionKey }: Props) {
  const router = useRouter();
  const ids = rows.map((r) => r.id);
  const sel = useBulkSelection(ids, selectionKey);

  const [pending, setPending] = useState(false);
  const [confirm, setConfirm] = useState<BulkAction | null>(null);
  const [result, setResult] = useState<{
    title: string;
    processed: number;
    skipped: SkippedRow[];
  } | null>(null);

  function startAction(action: BulkAction) {
    if (sel.count > BULK_MAX_IDS) {
      toast.error(
        `Najednou lze zpracovat nejvýše ${BULK_MAX_IDS} faktur. Zmenši výběr.`,
      );
      return;
    }
    setConfirm(action);
  }

  async function runAction(action: BulkAction) {
    setPending(true);
    const selectedIds = sel.selectedVisibleIds;
    const res = await fetch("/api/invoice-requests/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: selectedIds, action }),
    });
    setPending(false);
    setConfirm(null);

    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      toast.error("Hromadná akce selhala", { description: j?.error });
      return;
    }

    const data = (await res.json()) as BulkResult;
    const labelById = new Map(rows.map((r) => [r.id, r.clientName || "—"]));
    const skipped: SkippedRow[] = data.skipped.map((s) => ({
      label: labelById.get(s.id) ?? s.id,
      reason: s.reason,
    }));

    sel.clear();
    router.refresh();
    setResult({
      title: action === "archive" ? "Archivace dokončena" : "Úhrada doplněna",
      processed: data.processed,
      skipped,
    });
    toast.success(
      `Zpracováno ${data.processed}, přeskočeno ${data.skipped.length}`,
    );
  }

  return (
    <div className="space-y-3">
      <BulkActionBar
        count={sel.count}
        pending={pending}
        markPaidLabel={MARK_PAID_LABEL}
        onClear={sel.clear}
        onArchive={() => startAction("archive")}
        onMarkPaid={() => startAction("mark_paid")}
      />

      {/* Mobile: sort dropdown + card list */}
      <div className="md:hidden space-y-2">
        <SortSelect
          options={MOBILE_SORT_OPTIONS}
          defaultField="issued_at"
          defaultDir="asc"
        />
        {rows.map((inv) => (
          <div
            key={inv.id}
            className="flex items-start gap-3 rounded-lg border bg-card p-4"
          >
            <IndeterminateCheckbox
              checked={sel.isSelected(inv.id)}
              onCheckedChange={() => sel.toggle(inv.id)}
              ariaLabel={`Vybrat fakturu ${inv.clientName}`}
              className="mt-0.5"
            />
            <Link
              href={`/invoices/${inv.id}`}
              className="min-w-0 flex-1 transition-colors active:opacity-70"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">{inv.clientName || "—"}</p>
                  <p className="text-xs text-muted-foreground font-mono mt-0.5">
                    VS {inv.variableSymbol ?? "—"}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <InvoiceStatusBadge status={inv.status} />
                  {inv.etnExport ? (
                    <EtnExportBadge export={inv.etnExport} />
                  ) : null}
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between text-sm">
                <span className="text-muted-foreground tabular-nums">
                  {formatDate(inv.issuedAt)}
                </span>
                <span className="font-mono tabular-nums font-medium">
                  {formatCZK(inv.totalWithVat)}
                </span>
              </div>
            </Link>
          </div>
        ))}
      </div>

      {/* Desktop: table */}
      <Card className="hidden md:block">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <IndeterminateCheckbox
                    checked={sel.allSelected}
                    indeterminate={sel.someSelected}
                    onCheckedChange={sel.toggleAll}
                    ariaLabel="Vybrat všechny zobrazené faktury"
                  />
                </TableHead>
                <TableHead>
                  <SortableHeader field="client_name" label="Klient" />
                </TableHead>
                <TableHead>
                  <SortableHeader field="issued_at" label="Datum" />
                </TableHead>
                <TableHead>
                  <SortableHeader field="due_date" label="Splatnost" />
                </TableHead>
                <TableHead>
                  <SortableHeader field="variable_symbol" label="VS" />
                </TableHead>
                <TableHead>
                  <SortableHeader field="payment_method" label="Způsob platby" />
                </TableHead>
                <TableHead className="text-right">
                  <SortableHeader
                    field="total"
                    label="Částka"
                    align="right"
                    defaultDir="desc"
                  />
                </TableHead>
                <TableHead>
                  <SortableHeader field="status" label="Status" />
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((inv) => (
                <TableRow key={inv.id} data-state={sel.isSelected(inv.id) ? "selected" : undefined}>
                  <TableCell className="w-10">
                    <IndeterminateCheckbox
                      checked={sel.isSelected(inv.id)}
                      onCheckedChange={() => sel.toggle(inv.id)}
                      ariaLabel={`Vybrat fakturu ${inv.clientName}`}
                    />
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/invoices/${inv.id}`}
                      className="hover:underline"
                    >
                      {inv.clientName || "—"}
                    </Link>
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {formatDate(inv.issuedAt)}
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {formatDate(inv.dueDate)}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {inv.variableSymbol ?? "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {inv.showPayment ? inv.paymentMethod ?? "—" : "—"}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums">
                    {formatCZK(inv.totalWithVat)}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col items-start gap-1">
                      <InvoiceStatusBadge status={inv.status} />
                      {inv.etnExport ? (
                        <EtnExportBadge export={inv.etnExport} />
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <BulkConfirmDialog
        open={confirm === "archive"}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={`Archivovat ${sel.count} faktur?`}
        description="Archivují se jen vystavené faktury (invoice_issued). Zrušené a už archivované se přeskočí. Archivované jsou v seznamu defaultně skryté."
        confirmLabel="Archivovat"
        pending={pending}
        onConfirm={() => runAction("archive")}
      />
      <BulkConfirmDialog
        open={confirm === "mark_paid"}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={`Označit ${sel.count} faktur jako uhrazené?`}
        description="U vydaných faktur se nemění stav — jen se doplní datum úhrady (dnešní) tam, kde chybí. Už uhrazené se přeskočí."
        confirmLabel="Doplnit datum úhrady"
        pending={pending}
        onConfirm={() => runAction("mark_paid")}
      />

      {result ? (
        <BulkResultDialog
          open
          onOpenChange={(o) => !o && setResult(null)}
          title={result.title}
          processed={result.processed}
          skipped={result.skipped}
        />
      ) : null}
    </div>
  );
}
