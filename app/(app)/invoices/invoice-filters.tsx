"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
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
  { value: "paid", label: "Zaplacené" },
  { value: "archived", label: "Archiv" },
  { value: "cancelled", label: "Zrušené" },
];

interface Props {
  initialStatus?: string;
  initialQ?: string;
}

export function InvoiceFilters({ initialStatus, initialQ }: Props) {
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

  return (
    <div className="flex gap-3 flex-wrap">
      <Select value={initialStatus ?? "all"} onValueChange={handleStatus}>
        <SelectTrigger className="w-56">
          <SelectValue />
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
    </div>
  );
}
