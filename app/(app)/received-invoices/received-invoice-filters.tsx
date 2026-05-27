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
import {
  RECEIVED_INVOICE_CATEGORY_LABELS,
  RECEIVED_INVOICE_STATUS_LABELS,
} from "@/types/received-invoice";

const STORAGE_KEY = "receivedInvoicesFilters";

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
  initialPreset: DatePreset;
  initialFrom: string;
  initialTo: string;
  initialSortBy: string;
  initialSortDir: "asc" | "desc";
}

export function ReceivedInvoiceFilters({
  initialStatus,
  initialCategory,
  initialQ,
  initialPreset,
  initialFrom,
  initialTo,
  initialSortBy,
  initialSortDir,
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
      router.push(
        qs ? `/received-invoices?${qs}` : "/received-invoices",
        { scroll: false },
      );
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  // Persist do localStorage
  useEffect(() => {
    const qs = params.toString();
    try {
      if (qs) localStorage.setItem(STORAGE_KEY, qs);
      else localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }, [params]);

  // Restore z localStorage při prvním načtení s prázdnou URL
  useEffect(() => {
    if (didRestoreRef.current) return;
    didRestoreRef.current = true;
    if (params.toString() !== "") return;
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        router.replace(`/received-invoices?${saved}`, { scroll: false });
      }
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function setParam(key: string, value: string | null) {
    const next = new URLSearchParams(params.toString());
    if (!value || value === "all") next.delete(key);
    else next.set(key, value);
    const qs = next.toString();
    router.push(
      qs ? `/received-invoices?${qs}` : "/received-invoices",
      { scroll: false },
    );
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
    router.push(`/received-invoices?${next.toString()}`, { scroll: false });
  }

  const resetFilters = useCallback(() => {
    setQ("");
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
    router.push("/received-invoices", { scroll: false });
  }, [router]);

  const hasActiveFilters =
    (initialStatus ?? "") !== "" ||
    (initialCategory ?? "") !== "" ||
    (initialQ ?? "") !== "" ||
    initialPreset !== "this_year" ||
    initialSortBy !== "issued_at" ||
    initialSortDir !== "asc";

  return (
    <div className="space-y-3">
      <div className="flex gap-3 flex-wrap items-end">
        <DateRangeFilter
          preset={initialPreset}
          from={initialFrom}
          to={initialTo}
          onChange={handleDateRange}
        />
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
          <Label className="text-xs text-muted-foreground">Hledat</Label>
          <Input
            placeholder="Dodavatel / popis…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="w-56"
          />
        </div>
      </div>

      {hasActiveFilters && (
        <div className="flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            onClick={resetFilters}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="mr-1 size-4" />
            Vymazat filtry
          </Button>
        </div>
      )}
    </div>
  );
}
