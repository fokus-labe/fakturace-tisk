"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, FileText, Loader2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";

export interface ImportRecord {
  id: string;
  imported_at: string;
  imported_by: string | null;
  user_email: string | null;
  kind?: "issued" | "received" | null;
  file_count: number;
  invoice_count_created: number;
  invoice_count_failed: number;
  client_count_created: number;
  filenames: string[] | null;
  errors: Array<{ index?: number; filename?: string | null; message: string }> | null;
  total_tokens_input: number | null;
  total_tokens_output: number | null;
  estimated_cost_usd: number | string | null;
}

interface Props {
  refreshKey: number;
  /** Filtr typu importu. Pokud není uveden, zobrazí se vše. */
  kind?: "issued" | "received";
  /** Popisek entity vytvořené při importu (Klienti / Dodavatelé). */
  entityLabel?: string;
}

function KindBadge({ kind }: { kind?: "issued" | "received" | null }) {
  if (kind === "received") {
    return (
      <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
        Přijaté
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-950 dark:text-blue-300">
      Vydané
    </span>
  );
}

const USD_TO_CZK = 24;

function fmtDateTime(s: string): string {
  return new Date(s).toLocaleString("cs-CZ");
}

function ImportStatusBadge({
  created,
  failed,
}: {
  created: number;
  failed: number;
}) {
  if (failed === 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
        <CheckCircle2 className="size-3" /> Úspěch
      </span>
    );
  }
  if (created === 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-950 dark:text-red-300">
        <XCircle className="size-3" /> Chyba
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-950 dark:text-amber-300">
      Částečné ({created}/{created + failed})
    </span>
  );
}

export function ImportHistory({
  refreshKey,
  kind,
  entityLabel = "Klienti",
}: Props) {
  const [history, setHistory] = useState<ImportRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<ImportRecord | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const url = kind
        ? `/api/import/history?kind=${kind}`
        : "/api/import/history";
      const res = await fetch(url);
      if (!res.ok) {
        setHistory([]);
        return;
      }
      const json = await res.json();
      setHistory(json.imports ?? []);
    } finally {
      setLoading(false);
    }
  }, [kind]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">Historie importů</h2>
        {loading ? (
          <Loader2 className="size-4 animate-spin text-muted-foreground" />
        ) : null}
      </div>

      {!loading && history.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Zatím žádné importy. Po prvním úspěšném importu se zde objeví záznam.
        </p>
      ) : null}

      {history.length > 0 && (
        <>
          {/* Mobile */}
          <div className="space-y-2 md:hidden">
            {history.map((imp) => (
              <div key={imp.id} className="rounded-lg border bg-card p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium">
                      {fmtDateTime(imp.imported_at)}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {imp.user_email ?? "—"}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <ImportStatusBadge
                      created={imp.invoice_count_created}
                      failed={imp.invoice_count_failed}
                    />
                    <KindBadge kind={imp.kind} />
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-muted-foreground">Faktury:</span>{" "}
                    <span className="font-mono tabular-nums">
                      {imp.invoice_count_created}/{imp.file_count}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">{entityLabel}:</span>{" "}
                    <span className="font-mono tabular-nums">
                      +{imp.client_count_created}
                    </span>
                  </div>
                  {imp.estimated_cost_usd != null ? (
                    <div className="col-span-2">
                      <span className="text-muted-foreground">Náklad:</span>{" "}
                      <span className="font-mono tabular-nums">
                        ${Number(imp.estimated_cost_usd).toFixed(4)} (~
                        {(Number(imp.estimated_cost_usd) * USD_TO_CZK).toFixed(
                          2,
                        )}{" "}
                        Kč)
                      </span>
                    </div>
                  ) : null}
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setDetail(imp)}
                  className="mt-3 px-0"
                >
                  Zobrazit detail →
                </Button>
              </div>
            ))}
          </div>

          {/* Desktop */}
          <div className="hidden overflow-hidden rounded-lg border md:block">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left">Datum</th>
                  <th className="px-4 py-3 text-left">Typ</th>
                  <th className="px-4 py-3 text-left">Uživatel</th>
                  <th className="px-4 py-3 text-right">Faktury</th>
                  <th className="px-4 py-3 text-right">{entityLabel}</th>
                  <th className="px-4 py-3 text-right">Náklad</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-right"></th>
                </tr>
              </thead>
              <tbody>
                {history.map((imp) => (
                  <tr key={imp.id} className="border-t hover:bg-muted/30">
                    <td className="px-4 py-3 tabular-nums">
                      {fmtDateTime(imp.imported_at)}
                    </td>
                    <td className="px-4 py-3">
                      <KindBadge kind={imp.kind} />
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                      {imp.user_email ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums">
                      {imp.invoice_count_created}/{imp.file_count}
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums">
                      +{imp.client_count_created}
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums text-xs">
                      {imp.estimated_cost_usd != null
                        ? `~${(Number(imp.estimated_cost_usd) * USD_TO_CZK).toFixed(2)} Kč`
                        : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <ImportStatusBadge
                        created={imp.invoice_count_created}
                        failed={imp.invoice_count_failed}
                      />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setDetail(imp)}
                      >
                        Detail
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <Dialog
        open={detail !== null}
        onOpenChange={(open) => !open && setDetail(null)}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          {detail && (
            <>
              <DialogHeader>
                <DialogTitle>Detail importu</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 text-sm">
                <div className="grid grid-cols-2 gap-3">
                  <Row label="Datum" value={fmtDateTime(detail.imported_at)} />
                  <Row label="Uživatel" value={detail.user_email ?? "—"} />
                  <Row
                    label="Faktury"
                    value={`${detail.invoice_count_created} / ${detail.file_count}`}
                  />
                  <Row
                    label={entityLabel}
                    value={`+${detail.client_count_created}`}
                  />
                  {detail.total_tokens_input != null ? (
                    <Row
                      label="Tokeny vstup"
                      value={detail.total_tokens_input.toLocaleString()}
                    />
                  ) : null}
                  {detail.total_tokens_output != null ? (
                    <Row
                      label="Tokeny výstup"
                      value={detail.total_tokens_output.toLocaleString()}
                    />
                  ) : null}
                  {detail.estimated_cost_usd != null ? (
                    <Row
                      label="Náklad"
                      value={`$${Number(detail.estimated_cost_usd).toFixed(4)} (~${(Number(detail.estimated_cost_usd) * USD_TO_CZK).toFixed(2)} Kč)`}
                    />
                  ) : null}
                </div>

                <Separator />

                {detail.filenames && detail.filenames.length > 0 ? (
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                      Soubory ({detail.filenames.length})
                    </p>
                    <ul className="space-y-1">
                      {detail.filenames.map((fn, i) => {
                        const failed = (detail.errors ?? []).some(
                          (e) => e.filename === fn,
                        );
                        return (
                          <li
                            key={i}
                            className="flex items-center gap-2 text-xs"
                          >
                            {failed ? (
                              <XCircle className="size-3.5 text-red-600" />
                            ) : (
                              <CheckCircle2 className="size-3.5 text-emerald-600" />
                            )}
                            <FileText className="size-3.5 text-muted-foreground" />
                            <span className="truncate font-mono">{fn}</span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ) : null}

                {detail.errors && detail.errors.length > 0 ? (
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                      Chyby ({detail.errors.length})
                    </p>
                    <ul className="space-y-1 text-xs">
                      {detail.errors.map((e, i) => (
                        <li
                          key={i}
                          className="rounded border border-red-200 bg-red-50 p-2 text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200"
                        >
                          {e.message}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDetail(null)}>
                  Zavřít
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-widest text-muted-foreground">
        {label}
      </p>
      <p className="mt-0.5 tabular-nums">{value}</p>
    </div>
  );
}
