"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowDownUp } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface SortOption {
  value: string; // "field|dir", např. "issued_at|asc"
  label: string;
}

interface SortSelectProps {
  options: SortOption[];
  defaultField: string;
  defaultDir: "asc" | "desc";
  className?: string;
}

export function SortSelect({
  options,
  defaultField,
  defaultDir,
  className,
}: SortSelectProps) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const field = params.get("sort_by") ?? defaultField;
  const dir = params.get("sort_dir") ?? defaultDir;
  const value = `${field}|${dir}`;

  function handleChange(next: string | null) {
    if (!next) return;
    const [f, d] = next.split("|");
    const updated = new URLSearchParams(params.toString());
    updated.set("sort_by", f);
    updated.set("sort_dir", d);
    router.push(`${pathname}?${updated.toString()}`, { scroll: false });
  }

  return (
    <Select value={value} onValueChange={handleChange}>
      <SelectTrigger className={className ?? "w-full"}>
        <span className="inline-flex items-center gap-2">
          <ArrowDownUp className="size-3.5 text-muted-foreground" />
          <SelectValue>
            {(v: string | null) =>
              options.find((o) => o.value === v)?.label ?? "Seřadit…"
            }
          </SelectValue>
        </span>
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
