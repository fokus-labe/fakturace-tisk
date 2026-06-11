"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Building2, Check, ChevronsUpDown } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface VenueOption {
  slug: string;
  name: string;
  brand_color?: string | null;
}

interface VenueSelectorProps {
  venues: VenueOption[];
  activeSlug: string;
}

export function VenueSelector({ venues, activeSlug }: VenueSelectorProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const active = venues.find((v) => v.slug === activeSlug);

  // User má jen 1 venue → bez dropdownu, jen statický text
  if (venues.length <= 1) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-foreground">
        <Building2 className="size-4 shrink-0 text-muted-foreground" />
        <span className="truncate">{active?.name ?? venues[0]?.name ?? "—"}</span>
      </div>
    );
  }

  const handleSelect = (slug: string) => {
    if (slug === activeSlug) return;
    startTransition(async () => {
      try {
        const res = await fetch("/api/venues/switch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slug }),
        });
        if (!res.ok) {
          const json = await res.json().catch(() => null);
          throw new Error(json?.error ?? "Přepnutí provozovny selhalo");
        }
        router.refresh();
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Přepnutí provozovny selhalo",
        );
      }
    });
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        disabled={isPending}
        className={cn(
          "flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium",
          "transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
          isPending && "opacity-60",
        )}
      >
        <Building2 className="size-4 shrink-0 text-muted-foreground" />
        <span className="flex-1 truncate text-left">
          {active?.name ?? "Vyber provozovnu"}
        </span>
        <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[var(--anchor-width)]">
        {venues.map((venue) => (
          <DropdownMenuItem
            key={venue.slug}
            onClick={() => handleSelect(venue.slug)}
            className="gap-2"
          >
            <Check
              className={cn(
                "size-4",
                venue.slug === activeSlug ? "opacity-100" : "opacity-0",
              )}
            />
            <span className="truncate">{venue.name}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
