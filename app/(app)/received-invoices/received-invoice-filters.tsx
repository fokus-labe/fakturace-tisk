"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
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
  RECEIVED_INVOICE_CATEGORY_LABELS,
  RECEIVED_INVOICE_STATUS_LABELS,
} from "@/types/received-invoice";

const STATUS_OPTIONS = [
  { value: "all", label: "Všechny statusy" },
  ...(
    Object.keys(RECEIVED_INVOICE_STATUS_LABELS) as Array<
      keyof typeof RECEIVED_INVOICE_STATUS_LABELS
    >
  ).map((k) => ({
    value: k,
    label: RECEIVED_INVOICE_STATUS_LABELS[k],
  })),
];

const CATEGORY_OPTIONS = [
  { value: "all", label: "Všechny kategorie" },
  ...(
    Object.keys(RECEIVED_INVOICE_CATEGORY_LABELS) as Array<
      keyof typeof RECEIVED_INVOICE_CATEGORY_LABELS
    >
  ).map((k) => ({
    value: k,
    label: RECEIVED_INVOICE_CATEGORY_LABELS[k],
  })),
];

interface Props {
  initialStatus?: string;
  initialCategory?: string;
  initialQ?: string;
  initialFrom?: string;
  initialTo?: string;
}

export function ReceivedInvoiceFilters({
  initialStatus,
  initialCategory,
  initialQ,
  initialFrom,
  initialTo,
}: Props) {
  const router = useRouter();
  const params = useSearchParams();
  const [q, setQ] = useState(initialQ ?? "");

  useEffect(() => {
    const t = setTimeout(() => {
      const next = new URLSearchParams(params.toString());
      if (q) next.set("q", q);
      else next.delete("q");
      router.push(`/received-invoices?${next.toString()}`);
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  function setParam(key: string, value: string | null) {
    const next = new URLSearchParams(params.toString());
    if (!value || value === "all") next.delete(key);
    else next.set(key, value);
    router.push(`/received-invoices?${next.toString()}`);
  }

  return (
    <div className="flex gap-3 flex-wrap items-end">
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Status</Label>
        <Select
          value={initialStatus ?? "all"}
          onValueChange={(v) => setParam("status", v)}
        >
          <SelectTrigger className="w-48">
            <SelectValue>
              {(value: string | null) =>
                STATUS_OPTIONS.find((o) => o.value === value)?.label ??
                "Všechny statusy"
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Kategorie</Label>
        <Select
          value={initialCategory ?? "all"}
          onValueChange={(v) => setParam("category", v)}
        >
          <SelectTrigger className="w-48">
            <SelectValue>
              {(value: string | null) =>
                CATEGORY_OPTIONS.find((o) => o.value === value)?.label ??
                "Všechny kategorie"
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
      </div>

      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Od</Label>
        <Input
          type="date"
          defaultValue={initialFrom ?? ""}
          onChange={(e) => setParam("from", e.target.value || null)}
          className="w-40"
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Do</Label>
        <Input
          type="date"
          defaultValue={initialTo ?? ""}
          onChange={(e) => setParam("to", e.target.value || null)}
          className="w-40"
        />
      </div>

      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Hledat</Label>
        <Input
          placeholder="Dodavatel / popis…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="w-56"
        />
      </div>
    </div>
  );
}
