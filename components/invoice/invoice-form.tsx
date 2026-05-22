"use client";

import { useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
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
import type { Client } from "@/types/invoice";

interface Props {
  clients: Pick<Client, "id" | "name">[];
}

const NEW_CLIENT_VALUE = "__new__";

export function InvoiceForm({ clients }: Props) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [clientChoice, setClientChoice] = useState<string>(
    clients[0]?.id ?? NEW_CLIENT_VALUE,
  );

  const form = useForm<InvoiceFormInput, unknown, InvoiceFormOutput>({
    resolver: zodResolver(invoiceFormSchema),
    defaultValues: {
      client_id: clients[0]?.id ?? "",
      issued_at: formatDateInput(new Date()),
      payment_method: "převodem",
      due_date: formatDateInput(
        new Date(Date.now() + 14 * 24 * 3600 * 1000),
      ),
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

  function handleClientChange(value: string | null) {
    const v = value ?? NEW_CLIENT_VALUE;
    setClientChoice(v);
    if (v === NEW_CLIENT_VALUE) setValue("client_id", "");
    else setValue("client_id", v);
  }

  async function onSubmit(values: InvoiceFormOutput) {
    setSubmitting(true);
    const usingNew = clientChoice === NEW_CLIENT_VALUE;
    if (usingNew && !values.new_client_name) {
      toast.error("Vyplň jméno nového klienta");
      setSubmitting(false);
      return;
    }
    const payload = {
      client_id: usingNew ? undefined : values.client_id || undefined,
      new_client: usingNew
        ? {
            name: values.new_client_name!,
            ico: values.new_client_ico || null,
            dic: values.new_client_dic || null,
            email: values.new_client_email || null,
            address_street: values.new_client_street || null,
            address_city: values.new_client_city || null,
            address_zip: values.new_client_zip || null,
            address_country: "Česká republika",
          }
        : undefined,
      issued_at: values.issued_at,
      due_date: values.due_date || null,
      variable_symbol: values.variable_symbol || undefined,
      payment_method: values.payment_method || "převodem",
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
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Klient</Label>
            <Select value={clientChoice} onValueChange={handleClientChange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {clients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
                <SelectItem value={NEW_CLIENT_VALUE}>
                  + Nový klient…
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {clientChoice === NEW_CLIENT_VALUE ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1.5 md:col-span-2">
                <Label>Jméno / název *</Label>
                <Input {...register("new_client_name")} />
              </div>
              <div className="space-y-1.5">
                <Label>IČO</Label>
                <Input {...register("new_client_ico")} />
              </div>
              <div className="space-y-1.5">
                <Label>DIČ</Label>
                <Input {...register("new_client_dic")} />
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <Label>Email</Label>
                <Input type="email" {...register("new_client_email")} />
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <Label>Ulice</Label>
                <Input {...register("new_client_street")} />
              </div>
              <div className="space-y-1.5">
                <Label>PSČ</Label>
                <Input {...register("new_client_zip")} />
              </div>
              <div className="space-y-1.5">
                <Label>Město</Label>
                <Input {...register("new_client_city")} />
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

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
            <Input type="date" {...register("issued_at")} />
            {errors.issued_at ? (
              <p className="text-xs text-destructive">
                {errors.issued_at.message}
              </p>
            ) : null}
          </div>
          <div className="space-y-1.5">
            <Label>Splatnost</Label>
            <Input type="date" {...register("due_date")} />
          </div>
          <div className="space-y-1.5">
            <Label>Variabilní symbol</Label>
            <Input
              placeholder="Auto-generovaný"
              {...register("variable_symbol")}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Způsob platby</Label>
            <Input {...register("payment_method")} />
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
