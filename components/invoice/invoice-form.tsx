"use client";

import { useMemo, useState } from "react";
import { useForm, useWatch, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { InvoiceItemsEditor } from "./invoice-items-editor";
import {
  invoiceFormSchema,
  type InvoiceFormInput,
  type InvoiceFormOutput,
} from "./invoice-form-schema";
import { calculateInvoiceTotals } from "@/lib/utils/vat";
import { formatCZK, formatDateInput } from "@/lib/utils/format";
import {
  DatePicker,
  dateToIso,
  isoToDate,
} from "@/components/ui/date-picker";
import { ClientCreateDialog } from "@/components/client/client-create-dialog";
import type { Client, IssuedPaymentMethod } from "@/types/invoice";

type ClientLite = Pick<Client, "id" | "name">;

interface Props {
  clients: ClientLite[];
}

const NEW_CLIENT_VALUE = "__new__";

const PAYMENT_METHOD_OPTIONS: { value: IssuedPaymentMethod; label: string }[] =
  [
    { value: "fakturace", label: "Fakturace" },
    { value: "hotovost", label: "Hotovost" },
    { value: "karta", label: "Karta" },
    { value: "QR", label: "QR" },
  ];

export function InvoiceForm({ clients }: Props) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [clientList, setClientList] = useState<ClientLite[]>(clients);
  const [clientDialogOpen, setClientDialogOpen] = useState(false);

  const form = useForm<InvoiceFormInput, unknown, InvoiceFormOutput>({
    resolver: zodResolver(invoiceFormSchema),
    defaultValues: {
      client_id: clients[0]?.id ?? "",
      issued_at: formatDateInput(new Date()),
      payment_method: "fakturace",
      due_date: formatDateInput(new Date(Date.now() + 14 * 24 * 3600 * 1000)),
      short_description: "",
      items: [
        { description: "", quantity: 1, unit_price_no_vat: 0, vat_rate: 21 },
      ],
    },
  });

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
    setValue,
  } = form;

  const watchedItems = useWatch({ control, name: "items" });
  const totals = useMemo(() => {
    const items = (watchedItems ?? []).map((it) => ({
      quantity: Number(it.quantity ?? 0),
      unit_price_no_vat: Number(it.unit_price_no_vat ?? 0),
      vat_rate: Number(it.vat_rate ?? 0),
    }));
    return calculateInvoiceTotals(items);
  }, [watchedItems]);

  const clientNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of clientList) map.set(c.id, c.name);
    return map;
  }, [clientList]);

  async function onSubmit(values: InvoiceFormOutput) {
    setSubmitting(true);
    if (!values.client_id) {
      toast.error("Vyber klienta");
      setSubmitting(false);
      return;
    }
    const payload = {
      client_id: values.client_id,
      issued_at: values.issued_at,
      due_date: values.due_date || null,
      variable_symbol: values.variable_symbol || undefined,
      payment_method: values.payment_method ?? "fakturace",
      short_description: values.short_description || null,
      notes: values.notes || null,
      items: values.items,
      source: "manual" as const,
    };
    const res = await fetch("/api/invoice-requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSubmitting(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      toast.error("Nepodařilo se uložit fakturu", {
        description: body?.error,
      });
      return;
    }
    const json = await res.json();
    toast.success("Faktura uložena jako koncept");
    router.push(`/invoices/${json.id}`);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Odběratel</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Label>Klient *</Label>
          <Controller
            control={control}
            name="client_id"
            render={({ field }) => (
              <Select
                value={field.value || ""}
                onValueChange={(v) => {
                  if (v === NEW_CLIENT_VALUE) {
                    setClientDialogOpen(true);
                    return;
                  }
                  field.onChange(v ?? "");
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue>
                    {(value: string | null) => {
                      if (!value) return "Vyber klienta…";
                      return clientNameById.get(value) ?? value;
                    }}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {clientList.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                  <SelectItem value={NEW_CLIENT_VALUE}>
                    + Vytvořit nového klienta
                  </SelectItem>
                </SelectContent>
              </Select>
            )}
          />
        </CardContent>
      </Card>

      <ClientCreateDialog
        open={clientDialogOpen}
        onOpenChange={setClientDialogOpen}
        onCreated={(c) => {
          setClientList((prev) => [...prev, { id: c.id, name: c.name }]);
          setValue("client_id", c.id);
          router.refresh();
        }}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Položky</CardTitle>
        </CardHeader>
        <CardContent>
          <InvoiceItemsEditor
            control={control}
            register={register}
            errors={errors}
          />
          <Separator className="my-4" />
          <div className="flex justify-end">
            <div className="w-full max-w-xs space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Bez DPH</span>
                <span>{formatCZK(totals.noVat)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">DPH</span>
                <span>{formatCZK(totals.vat)}</span>
              </div>
              <Separator />
              <div className="flex justify-between font-semibold text-base">
                <span>Celkem</span>
                <span>{formatCZK(totals.withVat)}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Detaily</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                  value={isoToDate(field.value)}
                  onChange={(d) => field.onChange(dateToIso(d))}
                />
              )}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Variabilní symbol</Label>
            <Input
              placeholder="Nepovinné – doplníš později"
              inputMode="numeric"
              className="font-mono"
              {...register("variable_symbol")}
            />
            <p className="text-xs text-muted-foreground">
              V konceptu může zůstat prázdný. Doplníš ho při označení faktury
              jako vystavené.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label>Způsob platby</Label>
            <Controller
              control={control}
              name="payment_method"
              render={({ field }) => (
                <Select
                  value={field.value ?? "fakturace"}
                  onValueChange={(v) => field.onChange(v ?? "fakturace")}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue>
                      {(value: string | null) =>
                        PAYMENT_METHOD_OPTIONS.find((o) => o.value === value)
                          ?.label ?? "Fakturace"
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHOD_OPTIONS.map((o) => (
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
            <Label>Krátký popis (pro ETN)</Label>
            <Input
              placeholder="např. FA 260100079"
              {...register("short_description")}
            />
            <p className="text-xs text-muted-foreground">
              Volitelné — použije se v ETN exportu místo názvu klienta.
            </p>
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label>Poznámka</Label>
            <Textarea rows={3} {...register("notes")} />
          </div>
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
        <Button type="submit" disabled={submitting}>
          {submitting ? "Ukládám…" : "Uložit fakturu"}
        </Button>
      </div>
    </form>
  );
}
