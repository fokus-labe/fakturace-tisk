"use client";

import { useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
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
import { generatePassword } from "@/lib/users/password";
import type { VenueLite } from "@/lib/users/types";
import {
  VenueAccessMatrix,
  accessMapToVenues,
  type AccessMap,
} from "./venue-access-matrix";
import { PasswordReveal } from "./password-reveal";

export function CreateUserDialog({
  open,
  onOpenChange,
  venues,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  venues: VenueLite[];
  onSuccess: () => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState(() => generatePassword());
  const [isAdmin, setIsAdmin] = useState(false);
  const [access, setAccess] = useState<AccessMap>(new Map());
  const [saving, setSaving] = useState(false);
  // Po úspěchu: zobraz vytvořené heslo
  const [createdPassword, setCreatedPassword] = useState<string | null>(null);
  const [createdEmail, setCreatedEmail] = useState<string>("");

  const reset = () => {
    setEmail("");
    setPassword(generatePassword());
    setIsAdmin(false);
    setAccess(new Map());
    setCreatedPassword(null);
    setCreatedEmail("");
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      // Pokud zavíráme po úspěšném vytvoření → refresh seznamu
      if (createdPassword) onSuccess();
      reset();
    }
    onOpenChange(next);
  };

  const submit = async () => {
    if (!email.trim()) {
      toast.error("Zadej email");
      return;
    }
    if (password.length < 8) {
      toast.error("Heslo musí mít aspoň 8 znaků");
      return;
    }
    if (!isAdmin && access.size === 0) {
      toast.error("Vyber aspoň jednu provozovnu nebo zapni Admin");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          password,
          isAdmin,
          venues: accessMapToVenues(access),
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error ?? "Vytvoření selhalo");
      setCreatedEmail(email.trim());
      setCreatedPassword(password);
      toast.success("Uživatel vytvořen");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Vytvoření selhalo");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        {createdPassword ? (
          <>
            <DialogHeader>
              <DialogTitle>Uživatel vytvořen</DialogTitle>
              <DialogDescription>
                Heslo pro <strong>{createdEmail}</strong>. Zobrazí se jen
                jednou — zkopíruj ho a předej uživateli.
              </DialogDescription>
            </DialogHeader>
            <PasswordReveal password={createdPassword} />
            <p className="text-xs text-muted-foreground">
              Po zavření je heslo ztraceno. V případě potřeby ho lze později
              resetovat.
            </p>
            <DialogFooter>
              <Button onClick={() => handleOpenChange(false)}>
                Zavřít a obnovit seznam
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Nový uživatel</DialogTitle>
              <DialogDescription>
                Vytvoří účet s auto-potvrzeným emailem (bez verifikace).
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <Label htmlFor="new-user-email" className="mb-1 block">
                  Email *
                </Label>
                <Input
                  id="new-user-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="jmeno@fokuslabe.cz"
                />
              </div>

              <div>
                <Label htmlFor="new-user-password" className="mb-1 block">
                  Heslo *
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="new-user-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="font-mono"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => setPassword(generatePassword())}
                    aria-label="Vygenerovat heslo"
                  >
                    <RefreshCw className="size-4" />
                  </Button>
                </div>
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
                onClick={() => handleOpenChange(false)}
                disabled={saving}
              >
                Zrušit
              </Button>
              <Button onClick={submit} disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="size-4 mr-2 animate-spin" />
                    Vytvářím…
                  </>
                ) : (
                  "Vytvořit"
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
