"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { PerVenueRole, UserRow, VenueLite } from "@/lib/users/types";
import {
  VenueAccessMatrix,
  accessMapToVenues,
  type AccessMap,
} from "./venue-access-matrix";

function buildAccessMap(user: UserRow): AccessMap {
  const map: AccessMap = new Map();
  if (!user.isAdmin) {
    for (const a of user.access) {
      // V matici jsou jen manager/viewer; admin role per-venue se nemapuje
      if (a.role === "manager" || a.role === "viewer") {
        map.set(a.slug, a.role as PerVenueRole);
      }
    }
  }
  return map;
}

export function EditUserDialog({
  user,
  open,
  onOpenChange,
  venues,
  onSuccess,
}: {
  user: UserRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  venues: VenueLite[];
  onSuccess: () => void;
}) {
  const [email, setEmail] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [access, setAccess] = useState<AccessMap>(new Map());
  const [saving, setSaving] = useState(false);

  // Předvyplň formulář při otevření / změně usera
  useEffect(() => {
    if (user) {
      setEmail(user.email ?? "");
      setIsAdmin(user.isAdmin);
      setAccess(buildAccessMap(user));
    }
  }, [user]);

  const submit = async () => {
    if (!user) return;
    if (!email.trim()) {
      toast.error("Zadej email");
      return;
    }
    if (!isAdmin && access.size === 0) {
      toast.error("Vyber aspoň jednu provozovnu nebo zapni Admin");
      return;
    }
    setSaving(true);
    try {
      const emailChanged = email.trim() !== (user.email ?? "");
      const res = await fetch(`/api/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          isAdmin,
          venues: accessMapToVenues(access),
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error ?? "Uložení selhalo");
      toast.success(
        emailChanged
          ? `Uloženo — ${email.trim()} se musí znovu přihlásit (změna emailu)`
          : "Uloženo",
      );
      onOpenChange(false);
      onSuccess();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Uložení selhalo");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Upravit uživatele</DialogTitle>
          <DialogDescription>
            Změna emailu nebo přístupů. Při změně emailu se uživatel musí znovu
            přihlásit.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="edit-user-email" className="mb-1 block">
              Email
            </Label>
            <Input
              id="edit-user-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <VenueAccessMatrix
            venues={venues}
            isAdmin={isAdmin}
            onIsAdminChange={setIsAdmin}
            access={access}
            onAccessChange={setAccess}
            disabled={saving}
          />
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Zrušit
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="size-4 mr-2 animate-spin" />
                Ukládám…
              </>
            ) : (
              "Uložit"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
