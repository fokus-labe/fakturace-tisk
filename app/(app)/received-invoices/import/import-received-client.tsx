"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  FileText,
  Loader2,
  Trash2,
  Upload,
  XCircle,
} from "lucide-react";
import pLimit from "p-limit";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { formatCZK } from "@/lib/utils/format";
import {
  RECEIVED_INVOICE_CATEGORY_LABELS,
  RECEIVED_PAYMENT_METHOD_LABELS,
  type ReceivedInvoiceCategory,
  type ReceivedPaymentMethod,
} from "@/types/received-invoice";
import { ImportHistory } from "../../import/import-history";

export interface SupplierLite {
  id: string;
  name: string;
  ico: string | null;
  default_payment_method: string | null;
  default_category: string | null;
}

type Confidence = "high" | "medium" | "low";

interface EditableReceivedInvoice {
  supplier: {
    name: string;
    ico: string;
    dic: string;
    address_street: string;
    address_city: string;
    address_zip: string;
  };
  supplier_invoice_number: string;
  issued_at: string;
  due_date: string;
  payment_method: ReceivedPaymentMethod;
  category: ReceivedInvoiceCategory;
  description: string;
  amount_no_vat: number;
  amount_vat: number;
  amount_total: number;
}

interface FileResult {
  file: File;
  filename: string;
  status: "pending" | "processing" | "done" | "error";
  data?: EditableReceivedInvoice;
  confidence?: Confidence;
  notes?: string | null;
  error?: string;
  approved: boolean;
  usage?: { input_tokens: number; output_tokens: number };
  matchedSupplierId: string | null;
  matchedSupplierName: string | null;
}

const MAX_FILES = 30;
const MAX_FILE_SIZE = 10 * 1024 * 1024;

const CATEGORY_ENTRIES = Object.entries(RECEIVED_INVOICE_CATEGORY_LABELS) as [
  ReceivedInvoiceCategory,
  string,
][];
const PAYMENT_ENTRIES = Object.entries(RECEIVED_PAYMENT_METHOD_LABELS) as [
  ReceivedPaymentMethod,
  string,
][];

function normalizeIco(v: string | null | undefined): string {
  return (v ?? "").trim();
}

function confidenceBadge(c: Confidence | undefined) {
  if (c === "high")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
        <CheckCircle2 className="size-3" /> Vysoká
      </span>
    );
  if (c === "medium")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-950 dark:text-amber-300">
        <AlertTriangle className="size-3" /> Střední
      </span>
    );
  if (c === "low")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-950 dark:text-red-300">
        <AlertTriangle className="size-3" /> Nízká
      </span>
    );
  return null;
}

export function ImportReceivedClient({
  suppliers,
}: {
  suppliers: SupplierLite[];
}) {
  const [files, setFiles] = useState<File[]>([]);
  const [results, setResults] = useState<FileResult[]>([]);
  const [processing, setProcessing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [historyKey, setHistoryKey] = useState(0);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Match dodavatele podle IČO (přesně), jinak podle názvu (case-insensitive).
  const matchSupplier = useCallback(
    (ico: string, name: string): SupplierLite | null => {
      const normIco = normalizeIco(ico);
      if (normIco) {
        const byIco = suppliers.find((s) => normalizeIco(s.ico) === normIco);
        if (byIco) return byIco;
      }
      const normName = name.trim().toLowerCase();
      if (normName) {
        const byName = suppliers.find(
          (s) => s.name.trim().toLowerCase() === normName,
        );
        if (byName) return byName;
      }
      return null;
    },
    [suppliers],
  );

  // Object URL pro PDF preview v dialogu
  useEffect(() => {
    if (editingIdx === null) {
      setPdfPreviewUrl(null);
      return;
    }
    const file = results[editingIdx]?.file;
    if (!file) {
      setPdfPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPdfPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [editingIdx, results]);

  const addFiles = useCallback((incoming: FileList | File[]) => {
    const arr = Array.from(incoming);
    const accepted: File[] = [];
    for (const f of arr) {
      if (f.type !== "application/pdf") {
        toast.error(`${f.name}: pouze PDF soubory`);
        continue;
      }
      if (f.size > MAX_FILE_SIZE) {
        toast.error(`${f.name}: soubor je větší než 10 MB`);
        continue;
      }
      accepted.push(f);
    }
    setFiles((prev) => {
      const next = [...prev, ...accepted];
      if (next.length > MAX_FILES) {
        toast.error(`Maximálně ${MAX_FILES} souborů najednou`);
        return next.slice(0, MAX_FILES);
      }
      return next;
    });
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setDragActive(false);
      if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
    },
    [addFiles],
  );

  const removeFile = (idx: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const processAll = async () => {
    if (files.length === 0) return;
    setProcessing(true);

    const initial: FileResult[] = files.map((f) => ({
      file: f,
      filename: f.name,
      status: "pending",
      approved: false,
      matchedSupplierId: null,
      matchedSupplierName: null,
    }));
    setResults(initial);

    const limit = pLimit(3);
    await Promise.all(
      files.map((file, idx) =>
        limit(async () => {
          setResults((prev) =>
            prev.map((r, i) => (i === idx ? { ...r, status: "processing" } : r)),
          );
          const fd = new FormData();
          fd.append("file", file);
          try {
            const res = await fetch("/api/import-received/parse-pdf", {
              method: "POST",
              body: fd,
            });
            const json = await res.json();
            if (!res.ok || !json.success) {
              throw new Error(json.error || "OCR selhalo");
            }
            const e = json.extracted;
            const matched = matchSupplier(
              e.supplier.ico ?? "",
              e.supplier.name ?? "",
            );

            // Defaults z existujícího dodavatele přebijí OCR návrh (lepší přesnost)
            const category: ReceivedInvoiceCategory =
              (matched?.default_category as ReceivedInvoiceCategory) ||
              e.category ||
              "ostatni";
            const payment_method: ReceivedPaymentMethod =
              (matched?.default_payment_method as ReceivedPaymentMethod) ||
              e.payment_method ||
              "faktura";

            const data: EditableReceivedInvoice = {
              supplier: {
                name: e.supplier.name ?? "",
                ico: e.supplier.ico ?? "",
                dic: e.supplier.dic ?? "",
                address_street: e.supplier.address_street ?? "",
                address_city: e.supplier.address_city ?? "",
                address_zip: e.supplier.address_zip ?? "",
              },
              supplier_invoice_number: e.supplier_invoice_number ?? "",
              issued_at: e.issued_at,
              due_date: e.due_date ?? "",
              payment_method,
              category,
              description: e.description ?? "",
              amount_no_vat: Number(e.amount_no_vat) || 0,
              amount_vat: Number(e.amount_vat) || 0,
              amount_total: Number(e.amount_total) || 0,
            };
            setResults((prev) =>
              prev.map((r, i) =>
                i === idx
                  ? {
                      ...r,
                      status: "done",
                      data,
                      confidence: e.confidence,
                      notes: e.notes ?? null,
                      usage: json.usage,
                      approved: e.confidence === "high",
                      matchedSupplierId: matched?.id ?? null,
                      matchedSupplierName: matched?.name ?? null,
                    }
                  : r,
              ),
            );
          } catch (err) {
            setResults((prev) =>
              prev.map((r, i) =>
                i === idx
                  ? {
                      ...r,
                      status: "error",
                      error:
                        err instanceof Error ? err.message : "Neznámá chyba",
                    }
                  : r,
              ),
            );
          }
        }),
      ),
    );

    setProcessing(false);
  };

  const stats = useMemo(() => {
    const done = results.filter((r) => r.status === "done");
    const errors = results.filter((r) => r.status === "error");
    const approved = done.filter((r) => r.approved);
    const high = done.filter((r) => r.confidence === "high");
    const needsReview = done.filter((r) => r.confidence !== "high");
    const tokensIn = results.reduce(
      (s, r) => s + (r.usage?.input_tokens ?? 0),
      0,
    );
    const tokensOut = results.reduce(
      (s, r) => s + (r.usage?.output_tokens ?? 0),
      0,
    );
    return {
      done: done.length,
      errors: errors.length,
      approved: approved.length,
      high: high.length,
      needsReview: needsReview.length,
      tokensIn,
      tokensOut,
    };
  }, [results]);

  const progressPct = useMemo(() => {
    if (results.length === 0) return 0;
    const finished = results.filter(
      (r) => r.status === "done" || r.status === "error",
    ).length;
    return Math.round((finished / results.length) * 100);
  }, [results]);

  const toggleApproved = (idx: number) => {
    setResults((prev) =>
      prev.map((r, i) => (i === idx ? { ...r, approved: !r.approved } : r)),
    );
  };

  const saveApproved = async () => {
    const approvedPairs = results
      .map((r, i) => ({ r, i }))
      .filter(({ r }) => r.status === "done" && r.approved);
    if (approvedPairs.length === 0) {
      toast.error("Nejsou žádné schválené faktury k importu");
      return;
    }
    setSaving(true);
    try {
      const approved = approvedPairs.map((p) => p.r);
      const payload = {
        invoices: approved.map((r) => ({
          filename: r.filename,
          supplier: {
            name: r.data!.supplier.name,
            ico: r.data!.supplier.ico || null,
            dic: r.data!.supplier.dic || null,
            address_street: r.data!.supplier.address_street || null,
            address_city: r.data!.supplier.address_city || null,
            address_zip: r.data!.supplier.address_zip || null,
          },
          supplier_invoice_number: r.data!.supplier_invoice_number || null,
          issued_at: r.data!.issued_at,
          due_date: r.data!.due_date || null,
          payment_method: r.data!.payment_method,
          category: r.data!.category,
          description: r.data!.description || "Bez popisu",
          amount_no_vat: r.data!.amount_no_vat,
          amount_vat: r.data!.amount_vat,
          amount_total: r.data!.amount_total,
          tokens_input: r.usage?.input_tokens,
          tokens_output: r.usage?.output_tokens,
        })),
      };
      const res = await fetch("/api/import-received/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Uložení selhalo");
      }

      // Upload PDF k vytvořeným fakturám (best-effort)
      const createdItems: Array<{ index: number; id: string }> =
        json.createdItems ?? [];
      let pdfUploaded = 0;
      const uploadLimit = pLimit(3);
      await Promise.all(
        createdItems.map((item) =>
          uploadLimit(async () => {
            const source = approved[item.index];
            if (!source?.file) return;
            try {
              const fd = new FormData();
              fd.append("file", source.file);
              const upRes = await fetch(
                `/api/received-invoices/${item.id}/upload-pdf`,
                { method: "POST", body: fd },
              );
              if (upRes.ok) pdfUploaded += 1;
            } catch {
              // ignore — faktura je uložená, jen PDF chybí
            }
          }),
        ),
      );

      if (json.created > 0) {
        toast.success(
          `Vytvořeno ${json.created} přijatých faktur${json.failed > 0 ? ` (${json.failed} selhalo)` : ""}${pdfUploaded > 0 ? `, ${pdfUploaded} PDF uloženo` : ""}`,
        );
      }
      if (json.failed > 0) {
        for (const e of json.errors ?? []) {
          toast.error(e.message);
        }
      }

      // Odeber úspěšně uložené řádky (ponech ty, co selhaly)
      const approvedIndices = approvedPairs.map((p) => p.i);
      const failedResultIndices = new Set(
        (json.errors ?? []).map(
          (e: { index: number }) => approvedIndices[e.index],
        ),
      );
      setResults((prev) =>
        prev.filter(
          (_, i) => failedResultIndices.has(i) || !approvedIndices.includes(i),
        ),
      );
      setHistoryKey((k) => k + 1);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Uložení selhalo");
    } finally {
      setSaving(false);
    }
  };

  const updateEditing = (
    patch: (inv: EditableReceivedInvoice) => EditableReceivedInvoice,
  ) => {
    if (editingIdx === null) return;
    setResults((prev) =>
      prev.map((r, i) =>
        i === editingIdx && r.data ? { ...r, data: patch(r.data) } : r,
      ),
    );
  };

  const recomputeVat = (rate: number) => {
    updateEditing((inv) => {
      const total = Number(inv.amount_total) || 0;
      const noVat = Math.round((total / (1 + rate / 100)) * 100) / 100;
      const vat = Math.round((total - noVat) * 100) / 100;
      return { ...inv, amount_no_vat: noVat, amount_vat: vat };
    });
  };

  const editing = editingIdx !== null ? results[editingIdx] : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl">Import přijatých faktur</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Nahraj PDF faktur od dodavatelů (REDDO, Cotton, Tiskárna Slon…). AI z
          nich vytáhne data, ty je zkontroluješ a uloží se jako přijaté faktury
          včetně PDF.
        </p>
      </div>

      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
        <AlertTriangle className="mr-2 inline size-4" />
        Tato funkce používá AI ke čtení PDF. Vždy si výsledky před uložením
        zkontroluj.
      </div>

      {/* Drop zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={onDrop}
        onClick={() => fileInputRef.current?.click()}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-10 text-center transition-colors",
          dragActive
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/25 hover:border-muted-foreground/50",
        )}
      >
        <Upload className="mb-3 size-8 text-muted-foreground" />
        <p className="font-medium">Přetáhni PDF sem nebo klikni pro výběr</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Max {MAX_FILES} souborů, 10 MB každý
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) addFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {/* Soubory čekající na zpracování */}
      {files.length > 0 && results.length === 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Připraveno ke zpracování ({files.length})</CardTitle>
            <Button onClick={processAll} disabled={processing}>
              {processing ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Zpracovávám…
                </>
              ) : (
                <>Spustit OCR ({files.length})</>
              )}
            </Button>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1 text-sm">
              {files.map((f, idx) => (
                <li
                  key={idx}
                  className="flex items-center justify-between rounded border bg-muted/30 px-3 py-1.5"
                >
                  <span className="flex items-center gap-2 truncate">
                    <FileText className="size-4 shrink-0 text-muted-foreground" />
                    <span className="truncate">{f.name}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {(f.size / 1024).toFixed(0)} KB
                    </span>
                  </span>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    onClick={() => removeFile(idx)}
                    aria-label="Odebrat"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Progress */}
      {processing && results.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span>
              Zpracováno {stats.done + stats.errors} z {results.length}
            </span>
            <span className="text-muted-foreground">{progressPct} %</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      )}

      {/* Results */}
      {results.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Výsledky ({results.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {results.map((r, idx) => (
              <div
                key={idx}
                className={cn(
                  "flex flex-wrap items-center gap-3 rounded-md border p-3 text-sm",
                  r.status === "error" &&
                    "border-red-300 bg-red-50/50 dark:bg-red-950/20",
                  r.status === "done" &&
                    r.approved &&
                    "border-emerald-300 bg-emerald-50/30 dark:bg-emerald-950/10",
                )}
              >
                <span className="flex shrink-0 items-center">
                  {r.status === "pending" && (
                    <FileText className="size-4 text-muted-foreground" />
                  )}
                  {r.status === "processing" && (
                    <Loader2 className="size-4 animate-spin text-primary" />
                  )}
                  {r.status === "done" && (
                    <CheckCircle2 className="size-4 text-emerald-600" />
                  )}
                  {r.status === "error" && (
                    <XCircle className="size-4 text-red-600" />
                  )}
                </span>
                <span
                  className="min-w-0 flex-1 truncate font-medium"
                  title={r.filename}
                >
                  {r.filename}
                </span>
                {r.status === "done" && r.data && (
                  <>
                    <span className="truncate text-muted-foreground">
                      {r.data.supplier.name}
                    </span>
                    {r.matchedSupplierId ? (
                      <span
                        className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                        title={`Dodavatel "${r.matchedSupplierName}" nalezen v databázi`}
                      >
                        <Building2 className="size-3" /> Existující
                      </span>
                    ) : (
                      <span
                        className="inline-flex shrink-0 items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                        title="Nový dodavatel — bude vytvořen při importu"
                      >
                        <Building2 className="size-3" /> Nový
                      </span>
                    )}
                    <span className="shrink-0 tabular-nums">
                      {formatCZK(r.data.amount_total)}
                    </span>
                    <span className="shrink-0 text-muted-foreground">
                      {r.data.issued_at}
                    </span>
                    {confidenceBadge(r.confidence)}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setEditingIdx(idx)}
                    >
                      Detail
                    </Button>
                    <label className="flex shrink-0 cursor-pointer items-center gap-1.5">
                      <input
                        type="checkbox"
                        checked={r.approved}
                        onChange={() => toggleApproved(idx)}
                        className="size-4"
                      />
                      <span className="text-xs">Schválit</span>
                    </label>
                  </>
                )}
                {r.status === "error" && (
                  <span className="text-red-700 dark:text-red-300">
                    {r.error}
                  </span>
                )}
                {r.notes && r.status === "done" && (
                  <p className="w-full text-xs italic text-amber-700 dark:text-amber-300">
                    Poznámka AI: {r.notes}
                  </p>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Summary + save */}
      {results.length > 0 && !processing && (
        <Card>
          <CardContent className="flex flex-wrap items-center justify-between gap-4 pt-6">
            <div className="space-y-1 text-sm">
              <div>
                <CheckCircle2 className="mr-1 inline size-4 text-emerald-600" />
                {stats.high} s vysokou důvěrou
              </div>
              <div>
                <AlertTriangle className="mr-1 inline size-4 text-amber-600" />
                {stats.needsReview} vyžaduje kontrolu
              </div>
              <div>
                <XCircle className="mr-1 inline size-4 text-red-600" />
                {stats.errors} chyb
              </div>
              {stats.tokensIn > 0 && (
                <div className="text-xs text-muted-foreground">
                  Tokeny: {stats.tokensIn.toLocaleString()} in /{" "}
                  {stats.tokensOut.toLocaleString()} out
                </div>
              )}
            </div>
            <Button
              size="lg"
              onClick={saveApproved}
              disabled={saving || stats.approved === 0}
            >
              {saving ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Ukládám…
                </>
              ) : (
                <>Importovat {stats.approved} schválených</>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      <Separator className="my-4" />

      <ImportHistory
        refreshKey={historyKey}
        kind="received"
        entityLabel="Dodavatelé"
      />

      {/* Edit dialog */}
      <Dialog
        open={editingIdx !== null}
        onOpenChange={(open) => !open && setEditingIdx(null)}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-5xl">
          {editing && editing.data && (
            <>
              <DialogHeader>
                <DialogTitle>{editing.filename}</DialogTitle>
              </DialogHeader>

              <div className="grid gap-6 lg:grid-cols-2">
                {/* Levý sloupec: formulář */}
                <div className="space-y-6">
                  {/* Dodavatel */}
                  <section className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                        Dodavatel
                      </h3>
                      {editing.matchedSupplierId ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                          <CheckCircle2 className="size-3" /> Existující:{" "}
                          {editing.matchedSupplierName}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                          Nový — vytvoří se při importu
                        </span>
                      )}
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="sm:col-span-2">
                        <Label>Název</Label>
                        <Input
                          value={editing.data.supplier.name}
                          onChange={(e) =>
                            updateEditing((inv) => ({
                              ...inv,
                              supplier: {
                                ...inv.supplier,
                                name: e.target.value,
                              },
                            }))
                          }
                        />
                      </div>
                      <div>
                        <Label>IČO</Label>
                        <Input
                          value={editing.data.supplier.ico}
                          onChange={(e) =>
                            updateEditing((inv) => ({
                              ...inv,
                              supplier: {
                                ...inv.supplier,
                                ico: e.target.value,
                              },
                            }))
                          }
                        />
                      </div>
                      <div>
                        <Label>DIČ</Label>
                        <Input
                          value={editing.data.supplier.dic}
                          onChange={(e) =>
                            updateEditing((inv) => ({
                              ...inv,
                              supplier: {
                                ...inv.supplier,
                                dic: e.target.value,
                              },
                            }))
                          }
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <Label>Ulice</Label>
                        <Input
                          value={editing.data.supplier.address_street}
                          onChange={(e) =>
                            updateEditing((inv) => ({
                              ...inv,
                              supplier: {
                                ...inv.supplier,
                                address_street: e.target.value,
                              },
                            }))
                          }
                        />
                      </div>
                      <div>
                        <Label>Město</Label>
                        <Input
                          value={editing.data.supplier.address_city}
                          onChange={(e) =>
                            updateEditing((inv) => ({
                              ...inv,
                              supplier: {
                                ...inv.supplier,
                                address_city: e.target.value,
                              },
                            }))
                          }
                        />
                      </div>
                      <div>
                        <Label>PSČ</Label>
                        <Input
                          value={editing.data.supplier.address_zip}
                          onChange={(e) =>
                            updateEditing((inv) => ({
                              ...inv,
                              supplier: {
                                ...inv.supplier,
                                address_zip: e.target.value,
                              },
                            }))
                          }
                        />
                      </div>
                    </div>
                  </section>

                  <Separator />

                  {/* Faktura */}
                  <section className="space-y-3">
                    <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                      Faktura
                    </h3>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <Label>Číslo faktury dodavatele</Label>
                        <Input
                          value={editing.data.supplier_invoice_number}
                          onChange={(e) =>
                            updateEditing((inv) => ({
                              ...inv,
                              supplier_invoice_number: e.target.value,
                            }))
                          }
                        />
                      </div>
                      <div>
                        <Label>Datum vystavení</Label>
                        <Input
                          type="date"
                          value={editing.data.issued_at}
                          onChange={(e) =>
                            updateEditing((inv) => ({
                              ...inv,
                              issued_at: e.target.value,
                            }))
                          }
                        />
                      </div>
                      <div>
                        <Label>Splatnost</Label>
                        <Input
                          type="date"
                          value={editing.data.due_date}
                          onChange={(e) =>
                            updateEditing((inv) => ({
                              ...inv,
                              due_date: e.target.value,
                            }))
                          }
                        />
                      </div>
                      <div>
                        <Label>Způsob platby</Label>
                        <Select
                          value={editing.data.payment_method}
                          onValueChange={(v) =>
                            updateEditing((inv) => ({
                              ...inv,
                              payment_method: v as ReceivedPaymentMethod,
                            }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {PAYMENT_ENTRIES.map(([value, label]) => (
                              <SelectItem key={value} value={value}>
                                {label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Kategorie</Label>
                        <Select
                          value={editing.data.category}
                          onValueChange={(v) =>
                            updateEditing((inv) => ({
                              ...inv,
                              category: v as ReceivedInvoiceCategory,
                            }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {CATEGORY_ENTRIES.map(([value, label]) => (
                              <SelectItem key={value} value={value}>
                                {label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="sm:col-span-2">
                        <Label>Popis</Label>
                        <Input
                          value={editing.data.description}
                          onChange={(e) =>
                            updateEditing((inv) => ({
                              ...inv,
                              description: e.target.value,
                            }))
                          }
                          placeholder="Krátký popis pro evidenci"
                        />
                      </div>
                    </div>
                  </section>

                  <Separator />

                  {/* Částky */}
                  <section className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                        Částky (Kč)
                      </h3>
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => recomputeVat(21)}
                        >
                          Dopočítat 21 %
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => recomputeVat(12)}
                        >
                          12 %
                        </Button>
                      </div>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div>
                        <Label>Bez DPH</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={editing.data.amount_no_vat}
                          onChange={(e) =>
                            updateEditing((inv) => ({
                              ...inv,
                              amount_no_vat: Number(e.target.value),
                            }))
                          }
                        />
                      </div>
                      <div>
                        <Label>DPH</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={editing.data.amount_vat}
                          onChange={(e) =>
                            updateEditing((inv) => ({
                              ...inv,
                              amount_vat: Number(e.target.value),
                            }))
                          }
                        />
                      </div>
                      <div>
                        <Label>Celkem</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={editing.data.amount_total}
                          onChange={(e) =>
                            updateEditing((inv) => ({
                              ...inv,
                              amount_total: Number(e.target.value),
                            }))
                          }
                        />
                      </div>
                    </div>
                    <div className="rounded bg-muted/40 p-3 text-sm tabular-nums">
                      Bez DPH {formatCZK(editing.data.amount_no_vat)} + DPH{" "}
                      {formatCZK(editing.data.amount_vat)} ={" "}
                      <strong>{formatCZK(editing.data.amount_total)}</strong>
                    </div>
                  </section>
                </div>

                {/* Pravý sloupec: PDF preview */}
                <div className="hidden lg:block">
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                    Náhled PDF
                  </h3>
                  {pdfPreviewUrl ? (
                    <iframe
                      src={pdfPreviewUrl}
                      className="h-[70vh] w-full rounded-md border"
                      title="Náhled faktury"
                    />
                  ) : (
                    <div className="flex h-[70vh] items-center justify-center rounded-md border text-sm text-muted-foreground">
                      Náhled není dostupný
                    </div>
                  )}
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setEditingIdx(null)}>
                  Hotovo
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
