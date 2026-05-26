"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface DeleteButtonProps {
  /** URL pro DELETE request (např. "/api/invoice-requests/abc") */
  endpoint: string;
  /** Kam přesměrovat po úspěšném smazání */
  redirectTo: string;
  /** Titulek dialogu */
  title?: string;
  /** Popis varovného textu */
  description: string;
  /** Label tlačítka (default "Smazat") */
  label?: string;
  /** Toast po smazání */
  successMessage?: string;
  /** Volitelná velikost (default "sm") */
  size?: "default" | "xs" | "sm" | "lg";
}

export function DeleteButton({
  endpoint,
  redirectTo,
  title = "Opravdu smazat?",
  description,
  label = "Smazat",
  successMessage = "Smazáno",
  size = "sm",
}: DeleteButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  async function handleDelete() {
    setPending(true);
    const res = await fetch(endpoint, { method: "DELETE" });
    if (!res.ok) {
      setPending(false);
      const j = await res.json().catch(() => ({}));
      toast.error("Smazání selhalo", { description: j?.error });
      return;
    }
    setOpen(false);
    setPending(false);
    toast.success(successMessage);
    router.push(redirectTo);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="destructive" size={size}>
            <Trash2 className="size-4 mr-2" />
            {label}
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={pending}
          >
            Zrušit
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={pending}
          >
            {pending ? (
              <>
                <Loader2 className="size-4 mr-2 animate-spin" />
                Mažu…
              </>
            ) : (
              <>
                <Trash2 className="size-4 mr-2" />
                Ano, smazat
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
