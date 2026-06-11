"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type ManagerUser = { id: string; email: string | null };
export type ManagerVenue = { id: string; name: string };
export type ManagerAssignment = {
  user_id: string;
  venue_id: string;
  role: "manager" | "viewer" | "admin";
};

const ROLE_LABELS: Record<ManagerAssignment["role"], string> = {
  manager: "Manažer",
  viewer: "Pouze čtení",
  admin: "Admin",
};

function key(userId: string, venueId: string) {
  return `${userId}:${venueId}`;
}

export function UserVenuesManager({
  users,
  venues,
  initialAssignments,
}: {
  users: ManagerUser[];
  venues: ManagerVenue[];
  initialAssignments: ManagerAssignment[];
}) {
  const [roles, setRoles] = useState<Map<string, ManagerAssignment["role"]>>(
    () =>
      new Map(
        initialAssignments.map((a) => [key(a.user_id, a.venue_id), a.role]),
      ),
  );
  const [busy, setBusy] = useState<Set<string>>(new Set());

  const setBusyKey = (k: string, on: boolean) =>
    setBusy((prev) => {
      const next = new Set(prev);
      if (on) next.add(k);
      else next.delete(k);
      return next;
    });

  const assign = async (
    userId: string,
    venueId: string,
    role: ManagerAssignment["role"],
  ) => {
    const k = key(userId, venueId);
    setBusyKey(k, true);
    try {
      const res = await fetch("/api/user-venues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, venue_id: venueId, role }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.error ?? "Změna selhala");
      }
      setRoles((prev) => new Map(prev).set(k, role));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Změna selhala");
    } finally {
      setBusyKey(k, false);
    }
  };

  const unassign = async (userId: string, venueId: string) => {
    const k = key(userId, venueId);
    setBusyKey(k, true);
    try {
      const res = await fetch(
        `/api/user-venues?user_id=${userId}&venue_id=${venueId}`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.error ?? "Odebrání selhalo");
      }
      setRoles((prev) => {
        const next = new Map(prev);
        next.delete(k);
        return next;
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Odebrání selhalo");
    } finally {
      setBusyKey(k, false);
    }
  };

  return (
    <div className="space-y-5">
      {users.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Žádní uživatelé nenačteni.
        </p>
      ) : (
        users.map((u) => (
          <div key={u.id} className="rounded-lg border p-4">
            <p className="mb-3 font-mono text-sm">{u.email ?? u.id}</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {venues.map((v) => {
                const k = key(u.id, v.id);
                const role = roles.get(k);
                const assigned = role !== undefined;
                const isBusy = busy.has(k);
                return (
                  <div
                    key={v.id}
                    className="flex items-center gap-2 rounded-md border bg-muted/20 px-3 py-2 text-sm"
                  >
                    <input
                      type="checkbox"
                      className="size-4"
                      checked={assigned}
                      disabled={isBusy}
                      onChange={(e) =>
                        e.target.checked
                          ? assign(u.id, v.id, "manager")
                          : unassign(u.id, v.id)
                      }
                    />
                    <span className="flex-1 truncate">{v.name}</span>
                    {assigned ? (
                      <Select
                        value={role}
                        onValueChange={(val) =>
                          assign(
                            u.id,
                            v.id,
                            val as ManagerAssignment["role"],
                          )
                        }
                      >
                        <SelectTrigger className="h-7 w-[130px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {(
                            Object.keys(ROLE_LABELS) as Array<
                              ManagerAssignment["role"]
                            >
                          ).map((r) => (
                            <SelectItem key={r} value={r}>
                              {ROLE_LABELS[r]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <span className="w-[130px] text-right text-xs text-muted-foreground">
                        bez přístupu
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
