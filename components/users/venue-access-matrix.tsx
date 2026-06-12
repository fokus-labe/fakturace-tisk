"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { PerVenueRole, VenueLite } from "@/lib/users/types";

const ROLE_LABELS: Record<PerVenueRole, string> = {
  manager: "Manažer",
  viewer: "Pouze čtení",
};

// Mapa slug → role pro vybrané venues. Slug chybí v mapě = bez přístupu.
export type AccessMap = Map<string, PerVenueRole>;

export function VenueAccessMatrix({
  venues,
  isAdmin,
  onIsAdminChange,
  access,
  onAccessChange,
  disabled,
}: {
  venues: VenueLite[];
  isAdmin: boolean;
  onIsAdminChange: (value: boolean) => void;
  access: AccessMap;
  onAccessChange: (next: AccessMap) => void;
  disabled?: boolean;
}) {
  const toggleVenue = (slug: string, checked: boolean) => {
    const next = new Map(access);
    if (checked) next.set(slug, next.get(slug) ?? "manager");
    else next.delete(slug);
    onAccessChange(next);
  };

  const setRole = (slug: string, role: PerVenueRole) => {
    const next = new Map(access);
    next.set(slug, role);
    onAccessChange(next);
  };

  return (
    <div className="space-y-3">
      <label className="flex items-center gap-2 text-sm font-medium">
        <input
          type="checkbox"
          className="size-4"
          checked={isAdmin}
          disabled={disabled}
          onChange={(e) => onIsAdminChange(e.target.checked)}
        />
        Admin (vidí všechny provozovny)
      </label>

      {isAdmin ? (
        <p className="rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          Uživatel získá roli <strong>admin</strong> ve všech provozovnách —
          vidí a spravuje vše. Per-venue přístupy se ignorují.
        </p>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">Per-venue přístupy:</p>
          <div className="grid gap-2">
            {venues.map((v) => {
              const role = access.get(v.slug);
              const assigned = role !== undefined;
              return (
                <div
                  key={v.slug}
                  className="flex items-center gap-2 rounded-md border bg-muted/20 px-3 py-2 text-sm"
                >
                  <input
                    type="checkbox"
                    className="size-4"
                    checked={assigned}
                    disabled={disabled}
                    onChange={(e) => toggleVenue(v.slug, e.target.checked)}
                  />
                  <span className="flex-1 truncate">{v.name}</span>
                  {assigned ? (
                    <Select
                      value={role}
                      onValueChange={(val) => setRole(v.slug, val as PerVenueRole)}
                      disabled={disabled}
                    >
                      <SelectTrigger className="h-7 w-[140px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.keys(ROLE_LABELS) as PerVenueRole[]).map((r) => (
                          <SelectItem key={r} value={r}>
                            {ROLE_LABELS[r]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <span className="w-[140px] text-right text-xs text-muted-foreground">
                      bez přístupu
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// Helper: AccessMap → payload pro API
export function accessMapToVenues(
  access: AccessMap,
): { slug: string; role: PerVenueRole }[] {
  return [...access.entries()].map(([slug, role]) => ({ slug, role }));
}
