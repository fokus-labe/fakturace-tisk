"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowDownCircle,
  ArrowUpCircle,
  Download,
  FileArchive,
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
import { RECEIVED_PAYMENT_METHOD_LABELS } from "@/types/received-invoice";

type EtnGroup = "in_period" | "earlier_unsubmitted";

interface PreviewRow {
  id: string;
  effective_date: string;
  label: string;
  number: string | null;
  amount_with_vat: number;
  amount_no_vat: number;
  payment_method: string;
  group: EtnGroup;
  submitted: boolean;
  export_period: { start: string; end: string } | null;
  has_pdf: boolean;
}

interface PreviewData {
  periodStart: string;
  periodEnd: string;
  issued: PreviewRow[];
  received: PreviewRow[];
  limits: { maxReceived: number; maxIssued: number };
}

interface ExportResult {
  export_id: string;
  xlsx: { url: string | null; filename: string };
  zipName: string;
  receivedPdfs: Array<{ url: string; name: string }>;
  missingPdfs: Array<{ label: string }>;
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

const PAYMENT_LABEL = (pm: string): string =>
  (RECEIVED_PAYMENT_METHOD_LABELS as Record<string, string>)[pm] ?? pm;

function downloadFromUrl(url: string, filename: string) {
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

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
  const [showSubmitted, setShowSubmitted] = useState(false);

  const [selIssued, setSelIssued] = useState<Set<string>>(new Set());
  const [selReceived, setSelReceived] = useState<Set<string>>(new Set());

  const [busy, setBusy] = useState<null | "xlsx" | "zip">(null);
  const [zipProgress, setZipProgress] = useState<{
    done: number;
    total: number;
  } | null>(null);
  // Cache výsledku pro aktuální výběr — ať Stáhnout XLSX i Stáhnout vše
  // nevytvoří dva exporty. Změna výběru cache invaliduje.
  const [result, setResult] = useState<ExportResult | null>(null);
  const [resultKey, setResultKey] = useState<string | null>(null);

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
    // Default: zaškrtnuté vše, co ještě nebylo odevzdané (obě skupiny).
    setSelReceived(
      new Set(json.received.filter((r) => !r.submitted).map((r) => r.id)),
    );
    setSelIssued(
      new Set(json.issued.filter((r) => !r.submitted).map((r) => r.id)),
    );
    setResult(null);
    setResultKey(null);
    setShowSubmitted(false);
  }

  function selectionKey(): string {
    return `${[...selIssued].sort().join(",")}|${[...selReceived]
      .sort()
      .join(",")}`;
  }

  function toggle(kind: "issued" | "received", id: string) {
    const setter = kind === "issued" ? setSelIssued : setSelReceived;
    setter((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    // Změna výběru → zahoď cachovaný export.
    setResult(null);
    setResultKey(null);
  }

  const selectedReceivedRows = useMemo(
    () => (preview?.received ?? []).filter((r) => selReceived.has(r.id)),
    [preview, selReceived],
  );
  const selectedIssuedRows = useMemo(
    () => (preview?.issued ?? []).filter((r) => selIssued.has(r.id)),
    [preview, selIssued],
  );

  const maxReceived = preview?.limits.maxReceived ?? 36;
  const maxIssued = preview?.limits.maxIssued ?? 12;

  // Faktury nad limit šablony = po seřazení podle data ty za hranicí.
  const overReceived = useMemo(() => {
    const sorted = [...selectedReceivedRows].sort((a, b) =>
      a.effective_date.localeCompare(b.effective_date),
    );
    return sorted.slice(maxReceived);
  }, [selectedReceivedRows, maxReceived]);
  const overIssued = useMemo(() => {
    const sorted = [...selectedIssuedRows].sort((a, b) =>
      a.effective_date.localeCompare(b.effective_date),
    );
    return sorted.slice(maxIssued);
  }, [selectedIssuedRows, maxIssued]);
  const overLimit = overReceived.length > 0 || overIssued.length > 0;

  // Vybrané přijaté faktury placené fakturou bez PDF přílohy (varování pro ZIP).
  const missingPdf = useMemo(
    () =>
      selectedReceivedRows.filter(
        (r) => r.payment_method === "faktura" && !r.has_pdf,
      ),
    [selectedReceivedRows],
  );

  const nothingSelected =
    selectedReceivedRows.length === 0 && selectedIssuedRows.length === 0;

  async function ensureExport(): Promise<ExportResult | null> {
    const key = selectionKey();
    if (result && resultKey === key) return result;
    const res = await fetch("/api/etn-export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        issuedIds: [...selIssued],
        receivedIds: [...selReceived],
        periodStart,
        periodEnd,
      }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      toast.error("Export selhal", { description: j?.error });
      return null;
    }
    const json = (await res.json()) as ExportResult;
    setResult(json);
    setResultKey(key);
    loadHistory();
    return json;
  }

  async function downloadXlsx() {
    setBusy("xlsx");
    const r = await ensureExport();
    setBusy(null);
    if (!r) return;
    if (r.xlsx.url) {
      downloadFromUrl(r.xlsx.url, r.xlsx.filename);
      toast.success("XLSX vygenerováno a staženo");
    } else {
      toast.error("Odkaz na XLSX se nepodařilo vytvořit");
    }
  }

  async function downloadZip() {
    setBusy("zip");
    const r = await ensureExport();
    if (!r) {
      setBusy(null);
      return;
    }
    try {
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();

      // ETN.xlsx
      if (r.xlsx.url) {
        const xr = await fetch(r.xlsx.url);
        zip.file("ETN.xlsx", await xr.blob());
      }

      const failed: string[] = [];
      setZipProgress({ done: 0, total: r.receivedPdfs.length });
      for (let i = 0; i < r.receivedPdfs.length; i++) {
        const pdf = r.receivedPdfs[i];
        try {
          const pr = await fetch(pdf.url);
          if (!pr.ok) throw new Error(String(pr.status));
          zip.file(pdf.name, await pr.blob());
        } catch {
          failed.push(pdf.name);
        }
        setZipProgress({ done: i + 1, total: r.receivedPdfs.length });
      }

      const blob = await zip.generateAsync({ type: "blob" });
      downloadFromUrl(URL.createObjectURL(blob), r.zipName);

      if (failed.length > 0) {
        toast.warning("ZIP dokončen bez některých příloh", {
          description: `Nepodařilo se stáhnout: ${failed.join(", ")}`,
        });
      } else {
        toast.success("ZIP se všemi podklady stažen");
      }
    } catch (e) {
      toast.error("Sestavení ZIPu selhalo", {
        description: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setZipProgress(null);
      setBusy(null);
    }
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
    if (json.xlsx_url) window.open(json.xlsx_url, "_blank");
    loadHistory();
  }

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Generovat ETN</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Vyber období. Náhled ukáže faktury z období i dříve neodevzdané.
            Odškrtni, co do exportu nechceš.
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
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h2 className="text-lg font-semibold">
              Náhled za {formatDate(preview.periodStart)} –{" "}
              {formatDate(preview.periodEnd)}
            </h2>
            <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={showSubmitted}
                onChange={(e) => setShowSubmitted(e.target.checked)}
                className="size-4"
              />
              Zobrazit i už odevzdané faktury
            </label>
          </div>

          <InvoiceGroup
            kind="received"
            title="NÁKLADY (přijaté)"
            icon="down"
            rows={preview.received}
            selected={selReceived}
            showSubmitted={showSubmitted}
            onToggle={(id) => toggle("received", id)}
            limit={maxReceived}
            selectedCount={selectedReceivedRows.length}
          />

          <InvoiceGroup
            kind="issued"
            title="TRŽBY (vydané)"
            icon="up"
            rows={preview.issued}
            selected={selIssued}
            showSubmitted={showSubmitted}
            onToggle={(id) => toggle("issued", id)}
            limit={maxIssued}
            selectedCount={selectedIssuedRows.length}
          />

          {overLimit ? (
            <Card className="border-red-300 bg-red-50">
              <CardContent className="p-4 space-y-2 text-sm text-red-900">
                <div className="flex items-center gap-2 font-medium">
                  <AlertTriangle className="size-4 text-red-600" />
                  Překročen limit šablony — stažení je blokované
                </div>
                {overReceived.length > 0 ? (
                  <div>
                    Náklady: vybráno {selectedReceivedRows.length}, limit{" "}
                    {maxReceived}. Nad limit ({overReceived.length}):{" "}
                    {overReceived
                      .map((r) => `${r.label} (${formatDate(r.effective_date)})`)
                      .join(", ")}
                  </div>
                ) : null}
                {overIssued.length > 0 ? (
                  <div>
                    Tržby: vybráno {selectedIssuedRows.length}, limit {maxIssued}.
                    Nad limit ({overIssued.length}):{" "}
                    {overIssued
                      .map((r) => `${r.label} (${formatDate(r.effective_date)})`)
                      .join(", ")}
                  </div>
                ) : null}
                <div className="text-red-700/80">
                  Odškrtni faktury nad limit nebo zúž období.
                </div>
              </CardContent>
            </Card>
          ) : null}

          {missingPdf.length > 0 ? (
            <Card className="border-amber-300 bg-amber-50">
              <CardContent className="p-4 space-y-1 text-sm text-amber-900">
                <div className="flex items-center gap-2 font-medium">
                  <AlertTriangle className="size-4 text-amber-600" />
                  Přijaté faktury (fakturou) bez PDF přílohy — nebudou v ZIPu
                </div>
                <ul className="list-disc pl-5">
                  {missingPdf.map((r) => (
                    <li key={r.id}>
                      {r.label}
                      {r.number ? ` (${r.number})` : ""}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ) : null}

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setPreview(null)}
              disabled={busy !== null}
              className="w-full sm:w-auto"
            >
              Zrušit náhled
            </Button>
            <Button
              variant="outline"
              onClick={downloadZip}
              disabled={busy !== null || overLimit || nothingSelected}
              className="w-full sm:w-auto"
            >
              {busy === "zip" ? (
                <>
                  <Loader2 className="size-4 mr-2 animate-spin" />
                  {zipProgress
                    ? `Sestavuji ZIP ${zipProgress.done}/${zipProgress.total}…`
                    : "Připravuji…"}
                </>
              ) : (
                <>
                  <FileArchive className="size-4 mr-2" />
                  Stáhnout vše (ZIP)
                </>
              )}
            </Button>
            <Button
              onClick={downloadXlsx}
              disabled={busy !== null || overLimit || nothingSelected}
              className="w-full sm:w-auto"
            >
              {busy === "xlsx" ? (
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
                      <TableRow key={row.id} id={`export-${row.id}`}>
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

function InvoiceGroup({
  kind,
  title,
  icon,
  rows,
  selected,
  showSubmitted,
  onToggle,
  limit,
  selectedCount,
}: {
  kind: "issued" | "received";
  title: string;
  icon: "down" | "up";
  rows: PreviewRow[];
  selected: Set<string>;
  showSubmitted: boolean;
  onToggle: (id: string) => void;
  limit: number;
  selectedCount: number;
}) {
  const inPeriod = rows.filter((r) => r.group === "in_period" && !r.submitted);
  const earlier = rows.filter((r) => r.group === "earlier_unsubmitted");
  const submitted = rows.filter((r) => r.group === "in_period" && r.submitted);

  const overLimit = selectedCount > limit;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center justify-between gap-3 flex-wrap">
          <span className="flex items-center gap-2">
            {icon === "down" ? (
              <ArrowDownCircle className="size-4 text-red-600" />
            ) : (
              <ArrowUpCircle className="size-4 text-emerald-600" />
            )}
            {title}
          </span>
          <span
            className={cn(
              "text-sm font-normal tabular-nums",
              overLimit
                ? "text-red-600 font-semibold"
                : "text-muted-foreground",
            )}
          >
            vybráno {selectedCount} / limit {limit}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground p-6">
            Žádné faktury v tomto rozsahu.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="w-8"></TableHead>
                  <TableHead>Datum</TableHead>
                  <TableHead>
                    {kind === "received" ? "Dodavatel" : "Klient"}
                  </TableHead>
                  <TableHead>Číslo</TableHead>
                  <TableHead>Platba</TableHead>
                  <TableHead className="text-right">s DPH</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <GroupRows
                  heading="V období"
                  tone="normal"
                  rows={inPeriod}
                  kind={kind}
                  selected={selected}
                  onToggle={onToggle}
                />
                <GroupRows
                  heading="Dříve neodevzdané (nikdy v exportu)"
                  tone="amber"
                  rows={earlier}
                  kind={kind}
                  selected={selected}
                  onToggle={onToggle}
                />
                {showSubmitted ? (
                  <GroupRows
                    heading="Už odevzdané"
                    tone="muted"
                    rows={submitted}
                    kind={kind}
                    selected={selected}
                    onToggle={onToggle}
                    showBadge
                  />
                ) : null}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function GroupRows({
  heading,
  tone,
  rows,
  kind,
  selected,
  onToggle,
  showBadge,
}: {
  heading: string;
  tone: "normal" | "amber" | "muted";
  rows: PreviewRow[];
  kind: "issued" | "received";
  selected: Set<string>;
  onToggle: (id: string) => void;
  showBadge?: boolean;
}) {
  if (rows.length === 0) return null;
  const toneClass =
    tone === "amber"
      ? "bg-amber-50 text-amber-900"
      : tone === "muted"
        ? "bg-muted/40 text-muted-foreground"
        : "bg-background text-muted-foreground";
  return (
    <>
      <TableRow className={toneClass}>
        <TableCell
          colSpan={6}
          className="py-1.5 text-xs font-medium uppercase tracking-wide"
        >
          {heading} ({rows.length})
        </TableCell>
      </TableRow>
      {rows.map((r) => (
        <TableRow key={r.id}>
          <TableCell>
            <input
              type="checkbox"
              checked={selected.has(r.id)}
              onChange={() => onToggle(r.id)}
              className="size-4"
              aria-label={`Vybrat ${r.label}`}
            />
          </TableCell>
          <TableCell className="tabular-nums">
            {formatDate(r.effective_date)}
          </TableCell>
          <TableCell className="max-w-xs truncate">
            {r.label}
            {showBadge && r.export_period ? (
              <span className="ml-2 inline-flex items-center rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                odevzdáno {formatDate(r.export_period.start)}–
                {formatDate(r.export_period.end)}
              </span>
            ) : null}
          </TableCell>
          <TableCell className="font-mono text-xs">{r.number ?? "—"}</TableCell>
          <TableCell className="text-muted-foreground">
            {kind === "received"
              ? PAYMENT_LABEL(r.payment_method)
              : r.payment_method}
          </TableCell>
          <TableCell className="text-right font-mono tabular-nums">
            {formatCZK(r.amount_with_vat)}
          </TableCell>
        </TableRow>
      ))}
    </>
  );
}
