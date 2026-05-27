"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DateRangeFilter } from "@/components/ui/date-range-filter";
import type { DatePreset } from "@/lib/date-range/presets";

const STORAGE_KEY = "invoicesFilters";

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
  initialPreset: DatePreset;
  initialFrom: string;
  initialTo: string;
}

export function InvoiceFilters({
  initialStatus,
  initialQ,
  initialShowArchived,
  initialPreset,
  initialFrom,
  initialTo,
}: Props) {
  const router = useRouter();
  const params = useSearchParams();
  const [q, setQ] = useState(initialQ ?? "");
  const didRestoreRef = useRef(false);

  // Debounced search → URL
  useEffect(() => {
    const t = setTimeout(() => {
      const next = new URLSearchParams(params.toString());
      if (q) next.set("q", q);
      else next.delete("q");
      const qs = next.toString();
      router.push(qs ? `/invoices?${qs}` : "/invoices", { scroll: false });
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  // Persist current URL params do localStorage při každé změně
  useEffect(() => {
    const qs = params.toString();
    try {
      if (qs) localStorage.setItem(STORAGE_KEY, qs);
      else localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore (private mode, quota)
    }
  }, [params]);

  // Restore z localStorage při prvním načtení, jen pokud URL nemá žádné params
  useEffect(() => {
    if (didRestoreRef.current) return;
    didRestoreRef.current = true;
    if (params.toString() !== "") return;
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        router.replace(`/invoices?${saved}`, { scroll: false });
      }
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleStatus(value: string | null) {
    const next = new URLSearchParams(params.toString());
    if (!value || value === "all") next.delete("status");
    else next.set("status", value);
    const qs = next.toString();
    router.push(qs ? `/invoices?${qs}` : "/invoices", { scroll: false });
  }

  function toggleArchived(checked: boolean) {
    const next = new URLSearchParams(params.toString());
    if (checked) next.set("show_archived", "1");
    else next.delete("show_archived");
    const qs = next.toString();
    router.push(qs ? `/invoices?${qs}` : "/invoices", { scroll: false });
  }

  function handleDateRange(r: {
    preset: DatePreset;
    from: string;
    to: string;
  }) {
    const next = new URLSearchParams(params.toString());
    next.set("preset", r.preset);
    if (r.from) next.set("from", r.from);
    else next.delete("from");
    if (r.to) next.set("to", r.to);
    else next.delete("to");
    router.push(`/invoices?${next.toString()}`, { scroll: false });
  }

  const resetFilters = useCallback(() => {
    setQ("");
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
    router.push("/invoices", { scroll: false });
  }, [router]);

  const hasActiveFilters =
    (initialStatus ?? "") !== "" ||
    (initialQ ?? "") !== "" ||
    !!initialShowArchived ||
    initialPreset !== "this_year";

  return (
    <div className="space-y-3">
      <div className="flex gap-3 flex-wrap items-end">
        <DateRangeFilter
          preset={initialPreset}
          from={initialFrom}
          to={initialTo}
          onChange={handleDateRange}
        />
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
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Label className="flex items-center gap-2 text-sm cursor-pointer select-none">
          <input
            type="checkbox"
            checked={!!initialShowArchived}
            onChange={(e) => toggleArchived(e.target.checked)}
            className="size-4 rounded border-input"
          />
          Zobrazit i archivované
        </Label>

        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={resetFilters}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="mr-1 size-4" />
            Vymazat filtry
          </Button>
        )}
      </div>
    </div>
  );
}
