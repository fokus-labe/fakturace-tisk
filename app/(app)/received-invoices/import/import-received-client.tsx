"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  FileText,
  Loader2,
  XCircle,
} from "lucide-react";
import pLimit from "p-limit";
import { toast } from "sonner";
import { FileGroupStage } from "@/components/import/file-group-stage";
import type { InvoiceGroup } from "@/lib/import/file-processing";
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
import { ClientCreateDialog } from "@/components/client/client-create-dialog";
import { SettlementImportCard } from "@/components/settlements/settlement-import-card";
import type { SettlementProvider } from "@/lib/settlements/compute";
import { ImportHistory } from "../../import/import-history";

export interface SupplierLite {
  id: string;
  name: string;
  ico: string | null;
  default_payment_method: string | null;
  default_category: string | null;
}

export interface ClientLite {
  id: string;
  name: string;
}

export interface EditableSettlement {
  provider: SettlementProvider;
  statement_number: string;
  statement_date: string;
  gross: number;
  fee: number;
  net: number;
  client_id: string | null;
  client_name: string | null;
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
  /** zdrojové soubory faktury v pořadí stran (pro náhled a upload originálu) */
  files: File[];
  /** primární popisek */
  filename: string;
  filenames: string[];
  pageCount: number;
  status: "pending" | "processing" | "done" | "error";
  /** typ dokladu — běžná faktura, nebo vyúčtování (náklad + tržba) */
  docType: "invoice" | SettlementProvider;
  data?: EditableReceivedInvoice;
  settlement?: EditableSettlement;
  confidence?: Confidence;
  notes?: string | null;
  error?: string;
  approved: boolean;
  usage?: { input_tokens: number; output_tokens: number };
  matchedSupplierId: string | null;
  matchedSupplierName: string | null;
}

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
  clients: initialClients,
}: {
  suppliers: SupplierLite[];
  clients: ClientLite[];
}) {
  const [results, setResults] = useState<FileResult[]>([]);
  const [clients, setClients] = useState<ClientLite[]>(initialClients);
  const [processing, setProcessing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [historyKey, setHistoryKey] = useState(0);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  // Inline založení odběratele pro tržbu z vyúčtování (index řádku settlementu).
  const [clientDialogFor, setClientDialogFor] = useState<number | null>(null);

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

  // Object URL(s) pro náhled v dialogu (PDF = 1 iframe, obrázky = galerie stran)
  useEffect(() => {
    if (editingIdx === null) {
      setPreviewUrls([]);
      return;
    }
    const files = results[editingIdx]?.files;
    if (!files || files.length === 0) {
      setPreviewUrls([]);
      return;
    }
    const urls = files.map((f) => URL.createObjectURL(f));
    setPreviewUrls(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [editingIdx, results]);

  const processGroups = async (groups: InvoiceGroup[]) => {
    if (groups.length === 0) return;
    setProcessing(true);

    const initial: FileResult[] = groups.map((g) => ({
      files: g.files.map((pf) => pf.file),
      filename:
        g.files.length > 1
          ? `Faktura, ${g.files.length} str. (${g.files[0].originalName})`
          : g.files[0].originalName,
      filenames: g.files.map((pf) => pf.originalName),
      pageCount: g.files.length,
      status: "pending",
      docType: "invoice",
      approved: false,
      matchedSupplierId: null,
      matchedSupplierName: null,
    }));
    setResults(initial);

    const limit = pLimit(3);
    await Promise.all(
      groups.map((group, idx) =>
        limit(async () => {
          setResults((prev) =>
            prev.map((r, i) => (i === idx ? { ...r, status: "processing" } : r)),
          );
          const fd = new FormData();
          for (const pf of group.files) fd.append("files", pf.file);
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

            // Vyúčtování (Shoptet Pay / Zásilkovna) — náklad + tržba v jednom.
            if (e.doc_type === "shoptet_pay" || e.doc_type === "zasilkovna") {
              const s = e.settlement ?? {};
              const settlement: EditableSettlement = {
                provider: e.doc_type as SettlementProvider,
                statement_number: s.statement_number ?? "",
                statement_date: s.statement_date ?? "",
                gross: Number(s.gross_amount) || 0,
                fee: Number(s.fee_amount) || 0,
                net: Number(s.net_amount) || 0,
                client_id: null,
                client_name: null,
              };
              setResults((prev) =>
                prev.map((r, i) =>
                  i === idx
                    ? {
                        ...r,
                        status: "done",
                        docType: e.doc_type as SettlementProvider,
                        settlement,
                        confidence: e.confidence,
                        notes: e.notes ?? null,
                        usage: json.usage,
                        approved: false,
                      }
                    : r,
                ),
              );
              return;
            }

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

  const updateSettlement = (
    idx: number,
    patch: Partial<EditableSettlement>,
  ) => {
    setResults((prev) =>
      prev.map((r, i) =>
        i === idx && r.settlement
          ? { ...r, settlement: { ...r.settlement, ...patch } }
          : r,
      ),
    );
  };

  const handleSettlementClientCreated = (client: {
    id: string;
    name: string;
  }) => {
    setClients((prev) =>
      prev.some((c) => c.id === client.id) ? prev : [...prev, client],
    );
    if (clientDialogFor !== null) {
      updateSettlement(clientDialogFor, {
        client_id: client.id,
        client_name: client.name,
      });
    }
    setClientDialogFor(null);
  };

  const uploadOriginal = async (
    receivedId: string,
    files: File[],
  ): Promise<boolean> => {
    if (!files?.length) return false;
    try {
      const fd = new FormData();
      for (const f of files) fd.append("files", f);
      const upRes = await fetch(
        `/api/received-invoices/${receivedId}/upload-pdf`,
        { method: "POST", body: fd },
      );
      return upRes.ok;
    } catch {
      return false;
    }
  };

  const saveApproved = async () => {
    const approvedEntries = results
      .map((r, i) => ({ r, i }))
      .filter(({ r }) => r.status === "done" && r.approved);
    if (approvedEntries.length === 0) {
      toast.error("Nejsou žádné schválené doklady k importu");
      return;
    }
    setSaving(true);
    const savedIdx = new Set<number>();
    let createdInvoices = 0;
    let createdSettlements = 0;
    let filesUploaded = 0;

    try {
      // 1) Běžné přijaté faktury — jedním requestem, přesně jako dnes.
      const regular = approvedEntries.filter(({ r }) => r.docType === "invoice");
      if (regular.length > 0) {
        const approved = regular.map((p) => p.r);
        const payload = {
          source_file_count: approved.reduce(
            (s, r) => s + (r.pageCount || 1),
            0,
          ),
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
        if (!res.ok) throw new Error(json.error || "Uložení selhalo");

        createdInvoices = json.created ?? 0;
        const createdItems: Array<{ index: number; id: string }> =
          json.createdItems ?? [];
        const uploadLimit = pLimit(3);
        await Promise.all(
          createdItems.map((item) =>
            uploadLimit(async () => {
              const source = approved[item.index];
              if (await uploadOriginal(item.id, source?.files ?? []))
                filesUploaded += 1;
            }),
          ),
        );
        const failedRegular = new Set(
          (json.errors ?? []).map((e: { index: number }) => e.index),
        );
        regular.forEach((entry, k) => {
          if (!failedRegular.has(k)) savedIdx.add(entry.i);
        });
        for (const e of json.errors ?? []) toast.error(e.message);
      }

      // 2) Vyúčtování — každé zvlášť přes RPC endpoint (atomická dvojice).
      const settlements = approvedEntries.filter(
        ({ r }) => r.docType !== "invoice",
      );
      for (const { r, i } of settlements) {
        const s = r.settlement!;
        const res = await fetch("/api/settlements", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            provider: s.provider,
            statement_number: s.statement_number,
            statement_date: s.statement_date,
            gross_amount: s.gross,
            fee_amount: s.fee,
            net_amount: s.net,
            client_id: s.client_id,
          }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          if (res.status === 409) {
            toast.error(json.error ?? "Výpis je už zaevidovaný", {
              description: "Tenhle výpis už v systému existuje.",
            });
          } else {
            toast.error(json.error ?? "Vyúčtování se nepodařilo uložit");
          }
          continue;
        }
        createdSettlements += 1;
        if (json.received_id && (await uploadOriginal(json.received_id, r.files)))
          filesUploaded += 1;
        savedIdx.add(i);
      }

      if (createdInvoices > 0 || createdSettlements > 0) {
        toast.success(
          `Importováno: ${createdInvoices} přijatých faktur, ${createdSettlements} vyúčtování${filesUploaded > 0 ? `, ${filesUploaded}× příloha uložena` : ""}`,
        );
      }

      setResults((prev) => prev.filter((_, i) => !savedIdx.has(i)));
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
          Nahraj PDF nebo fotky faktur od dodavatelů (REDDO, Cotton, Tiskárna
          Slon…), i focené mobilem včetně HEIC z iPhonu. AI z nich vytáhne data,
          ty je zkontroluješ a uloží se jako přijaté faktury včetně originálu.
          Vyúčtování Shoptet Pay a Zásilkovny AI rozpozná sama a udělá z nich
          dvojici náklad + tržba.
        </p>
      </div>

      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
        <AlertTriangle className="mr-2 inline size-4" />
        Tato funkce používá AI ke čtení PDF i fotek. Vždy si výsledky před
        uložením zkontroluj.
      </div>

      {/* Výběr souborů + seskupování stránek do faktur */}
      {results.length === 0 && (
        <FileGroupStage
          key={historyKey}
          onProcess={processGroups}
          processing={processing}
        />
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
            {results.map((r, idx) =>
              r.docType !== "invoice" && r.status === "done" && r.settlement ? (
                <SettlementImportCard
                  key={idx}
                  filename={r.filename}
                  settlement={r.settlement}
                  approved={r.approved}
                  clients={clients}
                  notes={r.notes}
                  onChange={(patch) => updateSettlement(idx, patch)}
                  onToggleApproved={() => toggleApproved(idx)}
                  onNewClient={() => setClientDialogFor(idx)}
                />
              ) : (
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
              ),
            )}
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
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                onClick={() => {
                  setResults([]);
                  setHistoryKey((k) => k + 1);
                }}
                disabled={saving}
              >
                Zahodit výsledky
              </Button>
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
            </div>
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

                {/* Pravý sloupec: náhled přílohy (PDF = iframe, fotky = galerie stran) */}
                <div className="hidden lg:block">
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                    Náhled přílohy
                    {editing.files.length > 1
                      ? ` (${editing.files.length} stran)`
                      : ""}
                  </h3>
                  {previewUrls.length === 0 ? (
                    <div className="flex h-[70vh] items-center justify-center rounded-md border text-sm text-muted-foreground">
                      Náhled není dostupný
                    </div>
                  ) : editing.files[0]?.type === "application/pdf" ? (
                    <iframe
                      src={previewUrls[0]}
                      className="h-[70vh] w-full rounded-md border"
                      title="Náhled faktury"
                    />
                  ) : (
                    <div className="flex h-[70vh] flex-col gap-2 overflow-y-auto rounded-md border p-2">
                      {previewUrls.map((u, i) => (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          key={i}
                          src={u}
                          alt={`Strana ${i + 1}`}
                          className="w-full rounded"
                        />
                      ))}
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

      {/* Inline založení odběratele pro tržbu z vyúčtování */}
      <ClientCreateDialog
        open={clientDialogFor !== null}
        onOpenChange={(o) => {
          if (!o) setClientDialogFor(null);
        }}
        onCreated={handleSettlementClientCreated}
      />
    </div>
  );
}
