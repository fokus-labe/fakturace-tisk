"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowDownCircle,
  ArrowUpCircle,
  Download,
  History,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DatePicker } from "@/components/ui/date-picker";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { formatCZK, formatDate, formatDateInput } from "@/lib/utils/format";
import {
  RECEIVED_PAYMENT_METHOD_LABELS,
  type ReceivedPaymentMethod,
} from "@/types/received-invoice";

interface PreviewReceived {
  doc_number: string | null;
  issued_at: string;
  supplier_name: string;
  payment_method: ReceivedPaymentMethod;
  amount_with_vat: number;
  amount_no_vat: number;
  description: string;
}

interface PreviewIssued {
  issued_at: string;
  amount_with_vat: number;
  amount_no_vat: number;
  payment_method: "fakturace" | "hotovost" | "karta" | "QR";
  short_description: string | null;
  client_name: string;
  external_invoice_number: string | null;
}

interface Warning {
  type: string;
  message: string;
  count: number;
}

interface PreviewData {
  receivedInvoices: PreviewReceived[];
  issuedInvoices: PreviewIssued[];
  warnings: Warning[];
}

interface EtnExportRow {
  id: string;
  period_start: string;
  period_end: string;
  exported_at: string;
  invoice_count_received: number;
  invoice_count_issued: number;
  total_received_with_vat: number | string;
  total_issued_with_vat: number | string;
  xlsx_url: string | null;
  filename: string;
}

function defaultFromDate(): Date {
  const d = new Date();
  d.setDate(d.getDate() - 14);
  return d;
}

const ISSUED_PAYMENT_LABELS: Record<string, string> = {
  fakturace: "fakturace",
  hotovost: "hotovost",
  karta: "karta",
  QR: "QR",
};

function DatePickerField({
  value,
  onChange,
  label,
}: {
  value: Date | undefined;
  onChange: (d: Date | undefined) => void;
  label: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <DatePicker value={value ?? null} onChange={onChange} />
    </div>
  );
}

export function EtnExportClient() {
  const [from, setFrom] = useState<Date | undefined>(defaultFromDate());
  const [to, setTo] = useState<Date | undefined>(new Date());
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [history, setHistory] = useState<EtnExportRow[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [regenerating, setRegenerating] = useState<string | null>(null);

  const periodStart = from ? formatDateInput(from) : "";
  const periodEnd = to ? formatDateInput(to) : "";

  async function loadHistory() {
    setLoadingHistory(true);
    const res = await fetch("/api/etn-export/history");
    setLoadingHistory(false);
    if (!res.ok) return;
    const json = await res.json();
    setHistory(json.exports ?? []);
  }

  useEffect(() => {
    loadHistory();
  }, []);

  async function fetchPreview() {
    if (!periodStart || !periodEnd) {
      toast.error("Vyplň období");
      return;
    }
    if (periodEnd < periodStart) {
      toast.error("Datum Do musí být po datu Od");
      return;
    }
    setLoadingPreview(true);
    const params = new URLSearchParams({ periodStart, periodEnd });
    const res = await fetch(`/api/etn-export/preview?${params}`);
    setLoadingPreview(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      toast.error("Náhled selhal", { description: j?.error });
      return;
    }
    const json = (await res.json()) as PreviewData;
    setPreview(json);
  }

  async function downloadXlsx() {
    setDownloading(true);
    const res = await fetch("/api/etn-export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ periodStart, periodEnd }),
    });
    if (!res.ok) {
      setDownloading(false);
      const j = await res.json().catch(() => ({}));
      toast.error("Export selhal", { description: j?.error });
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ETN_Fokus_tisk_${periodStart}_${periodEnd}.xlsx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setDownloading(false);
    toast.success("XLSX vygenerováno a staženo");
    loadHistory();
  }

  async function regenerate(id: string) {
    setRegenerating(id);
    const res = await fetch(`/api/etn-export/history/${id}/regenerate`, {
      method: "POST",
    });
    setRegenerating(null);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      toast.error("Regenerace selhala", { description: j?.error });
      return;
    }
    const json = await res.json();
    toast.success("Soubor regenerován");
    if (json.xlsx_url) {
      window.open(json.xlsx_url, "_blank");
    }
    loadHistory();
  }

  const receivedTotalWith =
    preview?.receivedInvoices.reduce((s, r) => s + r.amount_with_vat, 0) ?? 0;
  const receivedTotalNo =
    preview?.receivedInvoices.reduce((s, r) => s + r.amount_no_vat, 0) ?? 0;
  const issuedTotalWith =
    preview?.issuedInvoices.reduce((s, r) => s + r.amount_with_vat, 0) ?? 0;
  const issuedTotalNo =
    preview?.issuedInvoices.reduce((s, r) => s + r.amount_no_vat, 0) ?? 0;

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Generovat ETN</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Vyber období, za které chceš export vygenerovat. Standardně 1× za 14
            dní.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <DatePickerField label="Od datum *" value={from} onChange={setFrom} />
            <DatePickerField label="Do datum *" value={to} onChange={setTo} />
          </div>
          <Button
            onClick={fetchPreview}
            disabled={loadingPreview}
            className="w-full sm:w-auto"
          >
            {loadingPreview ? (
              <>
                <Loader2 className="size-4 mr-2 animate-spin" />
                Načítám…
              </>
            ) : (
              "Načíst náhled"
            )}
          </Button>
        </CardContent>
      </Card>

      {preview ? (
        <>
          <div>
            <h2 className="text-lg font-semibold">
              Náhled za {formatDate(periodStart)} – {formatDate(periodEnd)}
            </h2>
          </div>

          {preview.warnings.length > 0 ? (
            <Card className="border-amber-300 bg-amber-50">
              <CardContent className="p-4 space-y-2">
                {preview.warnings.map((w) => (
                  <div
                    key={w.type}
                    className="flex items-start gap-2 text-sm text-amber-900"
                  >
                    <AlertTriangle className="size-4 mt-0.5 shrink-0 text-amber-600" />
                    <span>{w.message}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center justify-between gap-3 flex-wrap">
                <span className="flex items-center gap-2">
                  <ArrowDownCircle className="size-4 text-red-600" />
                  NÁKLADY ({preview.receivedInvoices.length} položek)
                </span>
                <span className="text-sm font-normal text-muted-foreground font-mono tabular-nums">
                  s DPH:{" "}
                  <strong className="text-foreground">
                    {formatCZK(receivedTotalWith)}
                  </strong>{" "}
                  · bez DPH:{" "}
                  <strong className="text-foreground">
                    {formatCZK(receivedTotalNo)}
                  </strong>
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {preview.receivedInvoices.length === 0 ? (
                <p className="text-sm text-muted-foreground p-6">
                  Žádné přijaté faktury v období.
                </p>
              ) : (
                <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow>
                      <TableHead>Datum</TableHead>
                      <TableHead>Dodavatel</TableHead>
                      <TableHead>Platba</TableHead>
                      <TableHead>Popis</TableHead>
                      <TableHead className="text-right">s DPH</TableHead>
                      <TableHead className="text-right">bez DPH</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.receivedInvoices.map((r, i) => (
                      <TableRow key={i}>
                        <TableCell className="tabular-nums">
                          {formatDate(r.issued_at)}
                        </TableCell>
                        <TableCell>{r.supplier_name}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {RECEIVED_PAYMENT_METHOD_LABELS[r.payment_method] ??
                            r.payment_method}
                        </TableCell>
                        <TableCell className="max-w-xs truncate">
                          {r.description}
                        </TableCell>
                        <TableCell className="text-right font-mono tabular-nums">
                          {formatCZK(r.amount_with_vat)}
                        </TableCell>
                        <TableCell className="text-right font-mono tabular-nums">
                          {formatCZK(r.amount_no_vat)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center justify-between gap-3 flex-wrap">
                <span className="flex items-center gap-2">
                  <ArrowUpCircle className="size-4 text-emerald-600" />
                  TRŽBY ({preview.issuedInvoices.length} položek)
                </span>
                <span className="text-sm font-normal text-muted-foreground font-mono tabular-nums">
                  s DPH:{" "}
                  <strong className="text-foreground">
                    {formatCZK(issuedTotalWith)}
                  </strong>{" "}
                  · bez DPH:{" "}
                  <strong className="text-foreground">
                    {formatCZK(issuedTotalNo)}
                  </strong>
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {preview.issuedInvoices.length === 0 ? (
                <p className="text-sm text-muted-foreground p-6">
                  Žádné vystavené faktury v období.
                </p>
              ) : (
                <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow>
                      <TableHead>Datum</TableHead>
                      <TableHead>Klient / popis</TableHead>
                      <TableHead>Č. faktury</TableHead>
                      <TableHead>Platba</TableHead>
                      <TableHead className="text-right">s DPH</TableHead>
                      <TableHead className="text-right">bez DPH</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.issuedInvoices.map((r, i) => (
                      <TableRow key={i}>
                        <TableCell className="tabular-nums">
                          {formatDate(r.issued_at)}
                        </TableCell>
                        <TableCell className="max-w-xs truncate">
                          {r.short_description ||
                            (r.external_invoice_number
                              ? `FV ${r.external_invoice_number}`
                              : r.client_name)}
                        </TableCell>
                        <TableCell className="text-muted-foreground font-mono text-xs">
                          {r.external_invoice_number ?? "—"}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {ISSUED_PAYMENT_LABELS[r.payment_method] ??
                            r.payment_method}
                        </TableCell>
                        <TableCell className="text-right font-mono tabular-nums">
                          {formatCZK(r.amount_with_vat)}
                        </TableCell>
                        <TableCell className="text-right font-mono tabular-nums">
                          {formatCZK(r.amount_no_vat)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setPreview(null)}
              disabled={downloading}
              className="w-full sm:w-auto"
            >
              Zrušit náhled
            </Button>
            <Button
              onClick={downloadXlsx}
              disabled={downloading}
              className="w-full sm:w-auto"
            >
              {downloading ? (
                <>
                  <Loader2 className="size-4 mr-2 animate-spin" />
                  Generuji…
                </>
              ) : (
                <>
                  <Download className="size-4 mr-2" />
                  Stáhnout ETN.xlsx
                </>
              )}
            </Button>
          </div>
        </>
      ) : null}

      <Separator />

      <div className="space-y-3">
        <h2 className="text-base font-semibold flex items-center gap-2">
          <History className="size-4" />
          Historie exportů
        </h2>
        {loadingHistory && history.length === 0 ? (
          <p className="text-sm text-muted-foreground">Načítám…</p>
        ) : history.length === 0 ? (
          <p className="text-sm text-muted-foreground">Zatím žádné exporty.</p>
        ) : (
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead>Vygenerováno</TableHead>
                    <TableHead>Období</TableHead>
                    <TableHead>Náklady</TableHead>
                    <TableHead>Tržby</TableHead>
                    <TableHead>Soubor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="tabular-nums">
                        {formatDate(row.exported_at)}
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {formatDate(row.period_start)} –{" "}
                        {formatDate(row.period_end)}
                      </TableCell>
                      <TableCell className="text-sm">
                        {row.invoice_count_received}× ·{" "}
                        <span className="font-mono tabular-nums">
                          {formatCZK(Number(row.total_received_with_vat))}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm">
                        {row.invoice_count_issued}× ·{" "}
                        <span className="font-mono tabular-nums">
                          {formatCZK(Number(row.total_issued_with_vat))}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          {row.xlsx_url ? (
                            <a
                              href={row.xlsx_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={cn(
                                buttonVariants({
                                  variant: "outline",
                                  size: "sm",
                                }),
                              )}
                            >
                              <Download className="size-4 mr-2" />
                              Stáhnout
                            </a>
                          ) : null}
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={regenerating === row.id}
                            onClick={() => regenerate(row.id)}
                          >
                            <RefreshCw
                              className={cn(
                                "size-4 mr-2",
                                regenerating === row.id && "animate-spin",
                              )}
                            />
                            Vygenerovat znovu
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
