"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supplierSchema, type SupplierInput } from "@/lib/validations/supplier";
import {
  RECEIVED_INVOICE_CATEGORY_LABELS,
  RECEIVED_PAYMENT_METHOD_LABELS,
  type ReceivedInvoiceCategory,
  type ReceivedPaymentMethod,
} from "@/types/received-invoice";

interface Props {
  initial?: Partial<SupplierInput> & { id?: string };
  mode?: "create" | "edit";
}

const NONE = "__none__";

const PAYMENT_OPTIONS = (
  Object.keys(RECEIVED_PAYMENT_METHOD_LABELS) as ReceivedPaymentMethod[]
).map((v) => ({ value: v, label: RECEIVED_PAYMENT_METHOD_LABELS[v] }));

const CATEGORY_OPTIONS = (
  Object.keys(RECEIVED_INVOICE_CATEGORY_LABELS) as ReceivedInvoiceCategory[]
).map((v) => ({ value: v, label: RECEIVED_INVOICE_CATEGORY_LABELS[v] }));

export function SupplierForm({ initial, mode = "create" }: Props) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<SupplierInput>({
    resolver: zodResolver(supplierSchema),
    defaultValues: {
      name: initial?.name ?? "",
      ico: initial?.ico ?? "",
      dic: initial?.dic ?? "",
      address_street: initial?.address_street ?? "",
      address_city: initial?.address_city ?? "",
      address_zip: initial?.address_zip ?? "",
      address_country: initial?.address_country ?? "Česká republika",
      email: initial?.email ?? "",
      phone: initial?.phone ?? "",
      notes: initial?.notes ?? "",
      default_payment_method: initial?.default_payment_method ?? "",
      default_category: initial?.default_category ?? "",
    },
  });

  async function onSubmit(values: SupplierInput) {
    setSubmitting(true);
    const res = await fetch(
      mode === "create" ? "/api/suppliers" : `/api/suppliers/${initial?.id}`,
      {
        method: mode === "create" ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      },
    );
    setSubmitting(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      toast.error("Uložení selhalo", { description: j?.error });
      return;
    }
    toast.success("Dodavatel uložen");
    router.push("/suppliers");
    router.refresh();
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="grid grid-cols-1 md:grid-cols-2 gap-4"
        >
          <div className="space-y-1.5 md:col-span-2">
            <Label>Jméno / název *</Label>
            <Input {...register("name")} />
            {errors.name ? (
              <p className="text-xs text-destructive">{errors.name.message}</p>
            ) : null}
          </div>
          <div className="space-y-1.5">
            <Label>IČO</Label>
            <Input {...register("ico")} />
          </div>
          <div className="space-y-1.5">
            <Label>DIČ</Label>
            <Input {...register("dic")} />
          </div>
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input type="email" {...register("email")} />
          </div>
          <div className="space-y-1.5">
            <Label>Telefon</Label>
            <Input {...register("phone")} />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label>Ulice</Label>
            <Input {...register("address_street")} />
          </div>
          <div className="space-y-1.5">
            <Label>PSČ</Label>
            <Input {...register("address_zip")} />
          </div>
          <div className="space-y-1.5">
            <Label>Město</Label>
            <Input {...register("address_city")} />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label>Země</Label>
            <Input {...register("address_country")} />
          </div>

          <div className="space-y-1.5">
            <Label>Default způsob platby</Label>
            <Controller
              control={control}
              name="default_payment_method"
              render={({ field }) => (
                <Select
                  value={(field.value as string) || NONE}
                  onValueChange={(v) =>
                    field.onChange(!v || v === NONE ? "" : v)
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue>
                      {(value: string | null) => {
                        if (!value || value === NONE) return "Nezvoleno";
                        return (
                          PAYMENT_OPTIONS.find((o) => o.value === value)?.label ??
                          "Nezvoleno"
                        );
                      }}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Nezvoleno</SelectItem>
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

          <div className="space-y-1.5">
            <Label>Default kategorie</Label>
            <Controller
              control={control}
              name="default_category"
              render={({ field }) => (
                <Select
                  value={(field.value as string) || NONE}
                  onValueChange={(v) =>
                    field.onChange(!v || v === NONE ? "" : v)
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue>
                      {(value: string | null) => {
                        if (!value || value === NONE) return "Nezvoleno";
                        return (
                          CATEGORY_OPTIONS.find((o) => o.value === value)
                            ?.label ?? "Nezvoleno"
                        );
                      }}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Nezvoleno</SelectItem>
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

          <div className="space-y-1.5 md:col-span-2">
            <Label>Poznámky</Label>
            <Textarea rows={3} {...register("notes")} />
          </div>

          <div className="md:col-span-2 flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
            >
              Zrušit
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Ukládám…" : "Uložit"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
