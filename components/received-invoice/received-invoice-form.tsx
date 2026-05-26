"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm, Controller, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Upload, FileText, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { formatCZK, formatDateInput } from "@/lib/utils/format";
import {
  DatePicker,
  dateToIso,
  isoToDate,
} from "@/components/ui/date-picker";
import {
  receivedInvoiceSchema,
  type ReceivedInvoiceInput,
  type ReceivedInvoiceOutput,
} from "@/lib/validations/received-invoice";
import {
  RECEIVED_INVOICE_CATEGORY_LABELS,
  RECEIVED_PAYMENT_METHOD_LABELS,
  type ReceivedInvoiceCategory,
  type ReceivedPaymentMethod,
} from "@/types/received-invoice";
import type { Supplier } from "@/types/supplier";
import { SupplierCreateDialog } from "@/components/supplier/supplier-create-dialog";

type SupplierLite = Pick<
  Supplier,
  "id" | "name" | "default_payment_method" | "default_category"
>;

interface Props {
  suppliers: SupplierLite[];
  initial?: Partial<ReceivedInvoiceInput> & {
    id?: string;
    pdf_url?: string | null;
  };
  mode?: "create" | "edit";
}

const NEW_SUPPLIER_VALUE = "__new__";

const CATEGORY_OPTIONS = (
  Object.keys(RECEIVED_INVOICE_CATEGORY_LABELS) as ReceivedInvoiceCategory[]
).map((v) => ({ value: v, label: RECEIVED_INVOICE_CATEGORY_LABELS[v] }));

const PAYMENT_OPTIONS = (
  Object.keys(RECEIVED_PAYMENT_METHOD_LABELS) as ReceivedPaymentMethod[]
).map((v) => ({ value: v, label: RECEIVED_PAYMENT_METHOD_LABELS[v] }));

export function ReceivedInvoiceForm({
  suppliers,
  initial,
  mode = "create",
}: Props) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [markPaidNow, setMarkPaidNow] = useState(false);
  const [supplierList, setSupplierList] = useState<SupplierLite[]>(suppliers);
  const [supplierDialogOpen, setSupplierDialogOpen] = useState(false);

  const supplierById = useMemo(() => {
    const map = new Map<string, SupplierLite>();
    for (const s of supplierList) map.set(s.id, s);
    return map;
  }, [supplierList]);

  const today = formatDateInput(new Date());

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
    setValue,
    getValues,
  } = useForm<ReceivedInvoiceInput, unknown, ReceivedInvoiceOutput>({
    resolver: zodResolver(receivedInvoiceSchema),
    defaultValues: {
      supplier_id: initial?.supplier_id ?? suppliers[0]?.id ?? "",
      supplier_invoice_number: initial?.supplier_invoice_number ?? "",
      issued_at: initial?.issued_at ?? today,
      due_date: initial?.due_date ?? "",
      paid_at: initial?.paid_at ?? "",
      payment_method: initial?.payment_method ?? "faktura",
      amount_no_vat: initial?.amount_no_vat ?? 0,
      amount_vat: initial?.amount_vat ?? 0,
      amount_total: initial?.amount_total ?? 0,
      description: initial?.description ?? "",
      category: initial?.category ?? "ostatni",
      status: initial?.status ?? "draft",
      notes: initial?.notes ?? "",
    },
  });

  const supplierId = useWatch({ control, name: "supplier_id" });
  const amountNoVat = useWatch({ control, name: "amount_no_vat" });
  const amountVat = useWatch({ control, name: "amount_vat" });
  const paymentMethod = useWatch({ control, name: "payment_method" });

  // Auto-fill default_payment_method + default_category po výběru dodavatele
  // (jen pro 'create' a jen pokud uživatel hodnoty zatím neměnil)
  useEffect(() => {
    if (mode !== "create" || !supplierId) return;
    const s = supplierById.get(supplierId);
    if (!s) return;
    if (s.default_payment_method) {
      setValue(
        "payment_method",
        s.default_payment_method as ReceivedPaymentMethod,
      );
    }
    if (s.default_category) {
      setValue("category", s.default_category as ReceivedInvoiceCategory);
    }
  }, [supplierId, supplierById, mode, setValue]);

  // Auto-calc total = no_vat + vat
  useEffect(() => {
    const noVat = Number(amountNoVat ?? 0);
    const vat = Number(amountVat ?? 0);
    if (!Number.isNaN(noVat) && !Number.isNaN(vat)) {
      setValue("amount_total", Number((noVat + vat).toFixed(2)));
    }
  }, [amountNoVat, amountVat, setValue]);

  // Auto-zaškrtnout "Označit jako zaplaceno hned" pro hotovostní platby
  useEffect(() => {
    if (mode !== "create") return;
    if (paymentMethod === "hotovost" || paymentMethod === "dobirka") {
      setMarkPaidNow(true);
    }
  }, [paymentMethod, mode]);

  const computedTotal = useMemo(() => {
    const noVat = Number(amountNoVat ?? 0);
    const vat = Number(amountVat ?? 0);
    return noVat + vat;
  }, [amountNoVat, amountVat]);

  async function onSubmit(values: ReceivedInvoiceOutput) {
    setSubmitting(true);

    // Výpočet statusu na základě "Označit zaplaceno hned"
    let status = values.status;
    let paid_at: string | null = values.paid_at || null;
    if (mode === "create") {
      if (markPaidNow) {
        status = "paid";
        if (!paid_at) paid_at = today;
      } else if (status === "draft") {
        status = "entered";
      }
    }

    const payload = {
      ...values,
      status,
      paid_at,
      supplier_invoice_number: values.supplier_invoice_number || null,
      due_date: values.due_date || null,
      notes: values.notes || null,
    };

    const res = await fetch(
      mode === "create"
        ? "/api/received-invoices"
        : `/api/received-invoices/${initial?.id}`,
      {
        method: mode === "create" ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    );

    if (!res.ok) {
      setSubmitting(false);
      const j = await res.json().catch(() => ({}));
      toast.error("Uložení selhalo", { description: j?.error });
      return;
    }

    const json = await res.json();
    const id = (json.data?.id ?? initial?.id) as string;

    // Upload PDF (pokud je file vybraný)
    if (file && id) {
      const fd = new FormData();
      fd.append("file", file);
      const uploadRes = await fetch(
        `/api/received-invoices/${id}/upload-pdf`,
        { method: "POST", body: fd },
      );
      if (!uploadRes.ok) {
        const j = await uploadRes.json().catch(() => ({}));
        toast.error("PDF se nepodařilo nahrát", { description: j?.error });
      }
    }

    setSubmitting(false);
    toast.success(
      mode === "create" ? "Přijatá faktura uložena" : "Faktura aktualizována",
    );
    router.push(`/received-invoices/${id}`);
    router.refresh();
  }

  function recalcFromTotal() {
    const total = Number(getValues("amount_total") ?? 0);
    const noVat = Number(getValues("amount_no_vat") ?? 0);
    if (total > 0 && noVat >= 0) {
      const vat = Math.max(0, total - noVat);
      setValue("amount_vat", Number(vat.toFixed(2)));
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dodavatel</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Label>Dodavatel *</Label>
          <Controller
            control={control}
            name="supplier_id"
            render={({ field }) => (
              <Select
                value={field.value || ""}
                onValueChange={(v) => {
                  if (v === NEW_SUPPLIER_VALUE) {
                    setSupplierDialogOpen(true);
                    return;
                  }
                  field.onChange(v ?? "");
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue>
                    {(value: string | null) => {
                      if (!value) return "Vyber dodavatele…";
                      return supplierById.get(value)?.name ?? value;
                    }}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {supplierList.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                  <SelectItem value={NEW_SUPPLIER_VALUE}>
                    + Vytvořit nového dodavatele
                  </SelectItem>
                </SelectContent>
              </Select>
            )}
          />
          {errors.supplier_id ? (
            <p className="text-xs text-destructive">
              {errors.supplier_id.message}
            </p>
          ) : null}
        </CardContent>
      </Card>

      <SupplierCreateDialog
        open={supplierDialogOpen}
        onOpenChange={setSupplierDialogOpen}
        onCreated={(s) => {
          const lite: SupplierLite = {
            id: s.id,
            name: s.name,
            default_payment_method: s.default_payment_method,
            default_category: s.default_category,
          };
          setSupplierList((prev) => [...prev, lite]);
          setValue("supplier_id", s.id);
          if (s.default_payment_method) {
            setValue(
              "payment_method",
              s.default_payment_method as ReceivedPaymentMethod,
            );
          }
          if (s.default_category) {
            setValue(
              "category",
              s.default_category as ReceivedInvoiceCategory,
            );
          }
          router.refresh();
        }}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Detaily faktury</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Číslo faktury dodavatele</Label>
            <Input {...register("supplier_invoice_number")} />
          </div>
          <div className="space-y-1.5">
            <Label>Datum vystavení *</Label>
            <Controller
              control={control}
              name="issued_at"
              render={({ field }) => (
                <DatePicker
                  value={isoToDate(field.value)}
                  onChange={(d) => field.onChange(dateToIso(d))}
                />
              )}
            />
            {errors.issued_at ? (
              <p className="text-xs text-destructive">
                {errors.issued_at.message}
              </p>
            ) : null}
          </div>
          <div className="space-y-1.5">
            <Label>Splatnost</Label>
            <Controller
              control={control}
              name="due_date"
              render={({ field }) => (
                <DatePicker
                  value={isoToDate(field.value ?? null)}
                  onChange={(d) => field.onChange(dateToIso(d))}
                />
              )}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Způsob platby</Label>
            <Controller
              control={control}
              name="payment_method"
              render={({ field }) => (
                <Select
                  value={field.value || "faktura"}
                  onValueChange={(v) =>
                    field.onChange((v ?? "faktura") as ReceivedPaymentMethod)
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue>
                      {(value: string | null) =>
                        PAYMENT_OPTIONS.find((o) => o.value === value)
                          ?.label ?? "Faktura"
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div className="space-y-1.5 md:col-span-2">
            <Label>Popis *</Label>
            <Input
              {...register("description")}
              placeholder="např. Bavlněná trička 50ks"
            />
            {errors.description ? (
              <p className="text-xs text-destructive">
                {errors.description.message}
              </p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <Label>Kategorie *</Label>
            <Controller
              control={control}
              name="category"
              render={({ field }) => (
                <Select
                  value={field.value || "ostatni"}
                  onValueChange={(v) =>
                    field.onChange((v ?? "ostatni") as ReceivedInvoiceCategory)
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue>
                      {(value: string | null) =>
                        CATEGORY_OPTIONS.find((o) => o.value === value)
                          ?.label ?? "Ostatní"
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORY_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Částky</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label>Bez DPH</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                {...register("amount_no_vat")}
              />
            </div>
            <div className="space-y-1.5">
              <Label>DPH</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                {...register("amount_vat")}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Celkem s DPH</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                {...register("amount_total")}
              />
              {errors.amount_total ? (
                <p className="text-xs text-destructive">
                  {errors.amount_total.message}
                </p>
              ) : null}
            </div>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              Součet bez DPH + DPH ={" "}
              <strong className="text-foreground">
                {formatCZK(computedTotal)}
              </strong>
            </span>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={recalcFromTotal}
            >
              Dopočítat DPH z celkové částky
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">PDF příloha</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {initial?.pdf_url && !file ? (
            <div className="flex items-center gap-2 text-sm">
              <FileText className="size-4" />
              <span>PDF je nahrané.</span>
              <a
                href={`/api/received-invoices/${initial?.id}/pdf`}
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                Zobrazit
              </a>
            </div>
          ) : null}
          <label
            className={cn(
              "flex items-center gap-3 cursor-pointer rounded-md border border-dashed border-input p-4 hover:bg-muted/30 transition-colors",
              file && "border-solid bg-muted/30",
            )}
          >
            <Upload className="size-5 text-muted-foreground" />
            <div className="flex-1 text-sm">
              {file ? (
                <span className="font-medium">{file.name}</span>
              ) : (
                <span className="text-muted-foreground">
                  Vyber PDF (max 5 MB) — drag&amp;drop nebo klikni
                </span>
              )}
            </div>
            {file ? (
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                onClick={(e) => {
                  e.preventDefault();
                  setFile(null);
                }}
              >
                <X className="size-4" />
              </Button>
            ) : null}
            <input
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) setFile(f);
              }}
            />
          </label>
        </CardContent>
      </Card>

      {mode === "create" ? (
        <Card>
          <CardContent className="pt-6">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={markPaidNow}
                onChange={(e) => setMarkPaidNow(e.target.checked)}
                className="size-4 rounded border-input"
              />
              <span className="text-sm">
                Označit jako zaplaceno hned (datum = dnes)
              </span>
            </label>
            <p className="text-xs text-muted-foreground mt-1 pl-7">
              Vhodné pro hotovostní platby a dobírky. Jinak se faktura uloží
              jako „Zaevidováno“.
            </p>
          </CardContent>
        </Card>
      ) : null}

      <Separator />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Poznámky</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea rows={3} {...register("notes")} />
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={submitting}
        >
          Zrušit
        </Button>
        <Button type="submit" disabled={submitting || suppliers.length === 0}>
          {submitting ? "Ukládám…" : "Uložit"}
        </Button>
      </div>
    </form>
  );
}
