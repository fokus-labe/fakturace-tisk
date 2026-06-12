"use client";

import { useEffect, useState } from "react";
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
import type { UserRow } from "@/lib/users/types";
import { PasswordReveal } from "./password-reveal";

export function ResetPasswordDialog({
  user,
  open,
  onOpenChange,
}: {
  user: UserRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [password, setPassword] = useState("");
  const [manual, setManual] = useState(false);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  // Reset stavu při (znovu)otevření
  useEffect(() => {
    if (open) {
      setPassword(generatePassword());
      setManual(false);
      setSaving(false);
      setDone(false);
    }
  }, [open]);

  const submit = async () => {
    if (!user) return;
    if (password.length < 8) {
      toast.error("Heslo musí mít aspoň 8 znaků");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/users/${user.id}/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error ?? "Reset selhal");
      setDone(true);
      toast.success("Heslo resetováno");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Reset selhal");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {done ? (
          <>
            <DialogHeader>
              <DialogTitle>Nové heslo</DialogTitle>
              <DialogDescription>
                Heslo pro <strong>{user?.email}</strong>. Po zavření je heslo
                ztraceno!
              </DialogDescription>
            </DialogHeader>
            <PasswordReveal password={password} />
            <p className="text-xs text-muted-foreground">
              Uživatel se musí znovu přihlásit — staré přihlášení už neplatí.
            </p>
            <DialogFooter>
              <Button onClick={() => onOpenChange(false)}>Zavřít</Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Reset hesla</DialogTitle>
              <DialogDescription>
                Vygeneruj nebo zadej nové heslo pro{" "}
                <strong>{user?.email}</strong>. Uživatel se pak musí znovu
                přihlásit.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Label htmlFor="reset-password" className="sr-only">
                  Heslo
                </Label>
                <Input
                  id="reset-password"
                  value={password}
                  readOnly={!manual}
                  onChange={(e) => setPassword(e.target.value)}
                  className="font-mono"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setPassword(generatePassword())}
                  aria-label="Vygenerovat náhodné heslo"
                >
                  <RefreshCw className="size-4" />
                </Button>
              </div>
              {!manual ? (
                <button
                  type="button"
                  className="text-xs text-muted-foreground underline"
                  onClick={() => {
                    setManual(true);
                    setPassword("");
                  }}
                >
                  Zadat ručně
                </button>
              ) : null}
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
                    Resetuji…
                  </>
                ) : (
                  "Resetovat heslo"
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
