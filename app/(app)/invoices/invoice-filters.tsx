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

const STATUS_OPTIONS = [
  { value: "all", label: "Všechny statusy" },
  { value: "draft", label: "Koncept" },
  { value: "sent_to_accountant", label: "U účetní" },
  { value: "invoice_issued", label: "Vystavené" },
  { value: "archived", label: "Archiv" },
  { value: "cancelled", label: "Zrušené" },
];

interface Props {
  initialStatus?: string;
  initialQ?: string;
  initialShowArchived?: boolean;
}

export function InvoiceFilters({
  initialStatus,
  initialQ,
  initialShowArchived,
}: Props) {
  const router = useRouter();
  const params = useSearchParams();
  const [q, setQ] = useState(initialQ ?? "");

  useEffect(() => {
    const t = setTimeout(() => {
      const next = new URLSearchParams(params.toString());
      if (q) next.set("q", q);
      else next.delete("q");
      router.push(`/invoices?${next.toString()}`);
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  function handleStatus(value: string | null) {
    const next = new URLSearchParams(params.toString());
    if (!value || value === "all") next.delete("status");
    else next.set("status", value);
    router.push(`/invoices?${next.toString()}`);
  }

  function toggleArchived(checked: boolean) {
    const next = new URLSearchParams(params.toString());
    if (checked) next.set("show_archived", "1");
    else next.delete("show_archived");
    router.push(`/invoices?${next.toString()}`);
  }

  return (
    <div className="flex gap-3 flex-wrap items-end">
      <Select value={initialStatus ?? "all"} onValueChange={handleStatus}>
        <SelectTrigger className="w-56">
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
      <Input
        placeholder="Hledat klienta…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="max-w-xs"
      />
      <Label className="flex items-center gap-2 text-sm cursor-pointer select-none">
        <input
          type="checkbox"
          checked={!!initialShowArchived}
          onChange={(e) => toggleArchived(e.target.checked)}
          className="size-4 rounded border-input"
        />
        Zobrazit i archivované
      </Label>
    </div>
  );
}
