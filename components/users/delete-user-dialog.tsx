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
import type { UserRow } from "@/lib/users/types";

export function DeleteUserDialog({
  user,
  open,
  onOpenChange,
  onSuccess,
}: {
  user: UserRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}) {
  const [confirmEmail, setConfirmEmail] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (open) {
      setConfirmEmail("");
      setDeleting(false);
    }
  }, [open]);

  const matches = !!user?.email && confirmEmail.trim() === user.email;

  const submit = async () => {
    if (!user || !matches) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/users/${user.id}`, { method: "DELETE" });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.error ?? "Smazání selhalo");
      }
      toast.success("Uživatel smazán");
      onOpenChange(false);
      onSuccess();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Smazání selhalo");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Smazat uživatele</DialogTitle>
          <DialogDescription>
            Opravdu smazat <strong>{user?.email}</strong>? Tato akce je
            nevratná a odebere i všechny přístupy k provozovnám.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="delete-confirm-email">
            Pro potvrzení napiš email uživatele:
          </Label>
          <Input
            id="delete-confirm-email"
            value={confirmEmail}
            onChange={(e) => setConfirmEmail(e.target.value)}
            placeholder={user?.email ?? ""}
            autoComplete="off"
          />
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={deleting}
          >
            Zrušit
          </Button>
          <Button
            variant="destructive"
            onClick={submit}
            disabled={!matches || deleting}
          >
            {deleting ? (
              <>
                <Loader2 className="size-4 mr-2 animate-spin" />
                Mažu…
              </>
            ) : (
              "Smazat"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
