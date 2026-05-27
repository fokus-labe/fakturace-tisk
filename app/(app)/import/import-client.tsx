"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  FileText,
  Loader2,
  Plus,
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
import { ImportHistory } from "./import-history";

type Confidence = "high" | "medium" | "low";
type PaymentMethod = "fakturace" | "hotovost" | "karta" | "QR";

interface EditableItem {
  description: string;
  quantity: number;
  unit_price_no_vat: number;
  vat_rate: number;
}

interface EditableInvoice {
  client: {
    name: string;
    ico: string;
    dic: string;
    address_street: string;
    address_city: string;
    address_zip: string;
  };
  external_invoice_number: string;
  variable_symbol: string;
  issued_at: string;
  due_date: string;
  payment_method: PaymentMethod;
  items: EditableItem[];
}

interface FileResult {
  filename: string;
  status: "pending" | "processing" | "done" | "error";
  data?: EditableInvoice;
  confidence?: Confidence;
  notes?: string | null;
  error?: string;
  approved: boolean;
  usage?: { input_tokens: number; output_tokens: number };
}

const MAX_FILES = 30;
const MAX_FILE_SIZE = 10 * 1024 * 1024;

function itemsTotal(items: EditableItem[]) {
  let noVat = 0;
  let withVat = 0;
  for (const it of items) {
    const line = (Number(it.quantity) || 0) * (Number(it.unit_price_no_vat) || 0);
    noVat += line;
    withVat += line * (1 + (Number(it.vat_rate) || 0) / 100);
  }
  return { noVat, vat: withVat - noVat, withVat };
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

export function ImportClient() {
  const [files, setFiles] = useState<File[]>([]);
  const [results, setResults] = useState<FileResult[]>([]);
  const [processing, setProcessing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [historyKey, setHistoryKey] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback(
    (incoming: FileList | File[]) => {
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
    },
    [],
  );

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
      filename: f.name,
      status: "pending",
      approved: false,
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
            const res = await fetch("/api/import/parse-pdf", {
              method: "POST",
              body: fd,
            });
            const json = await res.json();
            if (!res.ok || !json.success) {
              throw new Error(json.error || "OCR selhalo");
            }
            const e = json.extracted;
            const data: EditableInvoice = {
              client: {
                name: e.client.name ?? "",
                ico: e.client.ico ?? "",
                dic: e.client.dic ?? "",
                address_street: e.client.address_street ?? "",
                address_city: e.client.address_city ?? "",
                address_zip: e.client.address_zip ?? "",
              },
              external_invoice_number: e.invoice.external_invoice_number ?? "",
              variable_symbol: e.invoice.variable_symbol ?? "",
              issued_at: e.invoice.issued_at,
              due_date: e.invoice.due_date ?? "",
              payment_method: e.invoice.payment_method ?? "fakturace",
              items: e.items.map((it: EditableItem) => ({
                description: it.description,
                quantity: Number(it.quantity),
                unit_price_no_vat: Number(it.unit_price_no_vat),
                vat_rate: Number(it.vat_rate),
              })),
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
    const approved = results.filter((r) => r.status === "done" && r.approved);
    if (approved.length === 0) {
      toast.error("Nejsou žádné schválené faktury k importu");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        invoices: approved.map((r) => ({
          filename: r.filename,
          client: {
            name: r.data!.client.name,
            ico: r.data!.client.ico || null,
            dic: r.data!.client.dic || null,
            address_street: r.data!.client.address_street || null,
            address_city: r.data!.client.address_city || null,
            address_zip: r.data!.client.address_zip || null,
          },
          external_invoice_number: r.data!.external_invoice_number || null,
          variable_symbol: r.data!.variable_symbol || null,
          issued_at: r.data!.issued_at,
          due_date: r.data!.due_date || null,
          payment_method: r.data!.payment_method,
          items: r.data!.items,
          tokens_input: r.usage?.input_tokens,
          tokens_output: r.usage?.output_tokens,
        })),
      };
      const res = await fetch("/api/import/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Uložení selhalo");
      }
      if (json.created > 0) {
        toast.success(
          `Vytvořeno ${json.created} faktur${json.failed > 0 ? ` (${json.failed} selhalo)` : ""}`,
        );
      }
      if (json.failed > 0) {
        for (const e of json.errors ?? []) {
          toast.error(e.message);
        }
      }
      // Odeber úspěšně uložené řádky
      const approvedIndices = results
        .map((r, i) => ({ r, i }))
        .filter(({ r }) => r.status === "done" && r.approved)
        .map(({ i }) => i);
      const failedIndices = new Set(
        (json.errors ?? []).map((e: { index: number }) => approvedIndices[e.index]),
      );
      setResults((prev) =>
        prev.filter((_, i) => failedIndices.has(i) || !approvedIndices.includes(i)),
      );
      setHistoryKey((k) => k + 1);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Uložení selhalo");
    } finally {
      setSaving(false);
    }
  };

  const updateEditing = (patch: (inv: EditableInvoice) => EditableInvoice) => {
    if (editingIdx === null) return;
    setResults((prev) =>
      prev.map((r, i) =>
        i === editingIdx && r.data ? { ...r, data: patch(r.data) } : r,
      ),
    );
  };

  const editing = editingIdx !== null ? results[editingIdx] : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl">Hromadný import faktur</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Nahraj PDF historických vydaných faktur. Systém je přečte pomocí AI a
          vytáhne data. Po kontrole je uloží jako archivované faktury.
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
            {results.map((r, idx) => {
              const totals = r.data ? itemsTotal(r.data.items) : null;
              return (
                <div
                  key={idx}
                  className={cn(
                    "flex flex-wrap items-center gap-3 rounded-md border p-3 text-sm",
                    r.status === "error" && "border-red-300 bg-red-50/50 dark:bg-red-950/20",
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
                        {r.data.client.name}
                      </span>
                      <span className="shrink-0 tabular-nums">
                        {totals ? formatCZK(totals.withVat) : ""}
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
              );
            })}
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

      <ImportHistory refreshKey={historyKey} />

      {/* Edit dialog */}
      <Dialog
        open={editingIdx !== null}
        onOpenChange={(open) => !open && setEditingIdx(null)}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          {editing && editing.data && (
            <>
              <DialogHeader>
                <DialogTitle>{editing.filename}</DialogTitle>
              </DialogHeader>

              <div className="space-y-6">
                {/* Klient */}
                <section className="space-y-3">
                  <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                    Klient
                  </h3>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <Label>Název</Label>
                      <Input
                        value={editing.data.client.name}
                        onChange={(e) =>
                          updateEditing((inv) => ({
                            ...inv,
                            client: { ...inv.client, name: e.target.value },
                          }))
                        }
                      />
                    </div>
                    <div>
                      <Label>IČO</Label>
                      <Input
                        value={editing.data.client.ico}
                        onChange={(e) =>
                          updateEditing((inv) => ({
                            ...inv,
                            client: { ...inv.client, ico: e.target.value },
                          }))
                        }
                      />
                    </div>
                    <div>
                      <Label>DIČ</Label>
                      <Input
                        value={editing.data.client.dic}
                        onChange={(e) =>
                          updateEditing((inv) => ({
                            ...inv,
                            client: { ...inv.client, dic: e.target.value },
                          }))
                        }
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <Label>Ulice</Label>
                      <Input
                        value={editing.data.client.address_street}
                        onChange={(e) =>
                          updateEditing((inv) => ({
                            ...inv,
                            client: {
                              ...inv.client,
                              address_street: e.target.value,
                            },
                          }))
                        }
                      />
                    </div>
                    <div>
                      <Label>Město</Label>
                      <Input
                        value={editing.data.client.address_city}
                        onChange={(e) =>
                          updateEditing((inv) => ({
                            ...inv,
                            client: {
                              ...inv.client,
                              address_city: e.target.value,
                            },
                          }))
                        }
                      />
                    </div>
                    <div>
                      <Label>PSČ</Label>
                      <Input
                        value={editing.data.client.address_zip}
                        onChange={(e) =>
                          updateEditing((inv) => ({
                            ...inv,
                            client: {
                              ...inv.client,
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
                      <Label>Číslo faktury</Label>
                      <Input
                        value={editing.data.external_invoice_number}
                        onChange={(e) =>
                          updateEditing((inv) => ({
                            ...inv,
                            external_invoice_number: e.target.value,
                          }))
                        }
                      />
                    </div>
                    <div>
                      <Label>Variabilní symbol</Label>
                      <Input
                        value={editing.data.variable_symbol}
                        onChange={(e) =>
                          updateEditing((inv) => ({
                            ...inv,
                            variable_symbol: e.target.value,
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
                      <Label>Platba</Label>
                      <Select
                        value={editing.data.payment_method}
                        onValueChange={(v) =>
                          updateEditing((inv) => ({
                            ...inv,
                            payment_method: v as PaymentMethod,
                          }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="fakturace">Fakturace</SelectItem>
                          <SelectItem value="hotovost">Hotovost</SelectItem>
                          <SelectItem value="karta">Karta</SelectItem>
                          <SelectItem value="QR">QR</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </section>

                <Separator />

                {/* Položky */}
                <section className="space-y-3">
                  <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                    Položky
                  </h3>
                  <div className="space-y-2">
                    {editing.data.items.map((item, ii) => (
                      <div
                        key={ii}
                        className="grid grid-cols-12 items-end gap-2 rounded border p-2"
                      >
                        <div className="col-span-12 sm:col-span-6">
                          <Label className="text-xs">Popis</Label>
                          <Input
                            value={item.description}
                            onChange={(e) =>
                              updateEditing((inv) => ({
                                ...inv,
                                items: inv.items.map((it, j) =>
                                  j === ii
                                    ? { ...it, description: e.target.value }
                                    : it,
                                ),
                              }))
                            }
                          />
                        </div>
                        <div className="col-span-4 sm:col-span-2">
                          <Label className="text-xs">Množ.</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={item.quantity}
                            onChange={(e) =>
                              updateEditing((inv) => ({
                                ...inv,
                                items: inv.items.map((it, j) =>
                                  j === ii
                                    ? {
                                        ...it,
                                        quantity: Number(e.target.value),
                                      }
                                    : it,
                                ),
                              }))
                            }
                          />
                        </div>
                        <div className="col-span-4 sm:col-span-2">
                          <Label className="text-xs">Cena</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={item.unit_price_no_vat}
                            onChange={(e) =>
                              updateEditing((inv) => ({
                                ...inv,
                                items: inv.items.map((it, j) =>
                                  j === ii
                                    ? {
                                        ...it,
                                        unit_price_no_vat: Number(
                                          e.target.value,
                                        ),
                                      }
                                    : it,
                                ),
                              }))
                            }
                          />
                        </div>
                        <div className="col-span-3 sm:col-span-1">
                          <Label className="text-xs">DPH%</Label>
                          <Input
                            type="number"
                            value={item.vat_rate}
                            onChange={(e) =>
                              updateEditing((inv) => ({
                                ...inv,
                                items: inv.items.map((it, j) =>
                                  j === ii
                                    ? {
                                        ...it,
                                        vat_rate: Number(e.target.value),
                                      }
                                    : it,
                                ),
                              }))
                            }
                          />
                        </div>
                        <div className="col-span-1">
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            onClick={() =>
                              updateEditing((inv) => ({
                                ...inv,
                                items: inv.items.filter((_, j) => j !== ii),
                              }))
                            }
                            disabled={editing.data!.items.length <= 1}
                            aria-label="Smazat položku"
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        updateEditing((inv) => ({
                          ...inv,
                          items: [
                            ...inv.items,
                            {
                              description: "",
                              quantity: 1,
                              unit_price_no_vat: 0,
                              vat_rate: 21,
                            },
                          ],
                        }))
                      }
                    >
                      <Plus className="mr-1 size-4" /> Přidat položku
                    </Button>
                  </div>
                  {(() => {
                    const t = itemsTotal(editing.data.items);
                    return (
                      <div className="rounded bg-muted/40 p-3 text-sm tabular-nums">
                        Bez DPH {formatCZK(t.noVat)} + DPH {formatCZK(t.vat)} ={" "}
                        <strong>{formatCZK(t.withVat)}</strong>
                      </div>
                    );
                  })()}
                </section>
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
