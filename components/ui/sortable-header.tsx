"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronDown, ChevronUp, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

type SortDir = "asc" | "desc";

interface SortableHeaderProps {
  field: string;
  label: string;
  className?: string;
  align?: "left" | "right";
  defaultDir?: SortDir;
  defaultField?: string;
  defaultDirAll?: SortDir;
}

export function SortableHeader({
  field,
  label,
  className,
  align = "left",
  defaultDir = "asc",
  defaultField = "issued_at",
  defaultDirAll = "asc",
}: SortableHeaderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const currentField = params.get("sort_by") ?? defaultField;
  const currentDir: SortDir =
    params.get("sort_dir") === "desc" ? "desc" : defaultDirAll;
  const isActive = currentField === field;
  const nextDir: SortDir = isActive
    ? currentDir === "asc"
      ? "desc"
      : "asc"
    : defaultDir;

  function handleClick() {
    const next = new URLSearchParams(params.toString());
    next.set("sort_by", field);
    next.set("sort_dir", nextDir);
    router.push(`${pathname}?${next.toString()}`, { scroll: false });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        "inline-flex items-center gap-1 select-none transition-colors hover:text-foreground",
        align === "right" && "justify-end",
        isActive ? "text-foreground" : "text-muted-foreground",
        className,
      )}
    >
      <span>{label}</span>
      {isActive ? (
        currentDir === "asc" ? (
          <ChevronUp className="size-3.5" />
        ) : (
          <ChevronDown className="size-3.5" />
        )
      ) : (
        <ChevronsUpDown className="size-3.5 opacity-40" />
      )}
    </button>
  );
}
