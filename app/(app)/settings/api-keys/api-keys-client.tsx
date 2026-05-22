"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function ApiKeysClient() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [generated, setGenerated] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function create() {
    if (!name.trim()) return;
    setSubmitting(true);
    const res = await fetch("/api/api-keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim() }),
    });
    setSubmitting(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      toast.error("Vytvoření klíče selhalo", { description: j?.error });
      return;
    }
    const json = await res.json();
    setGenerated(json.data.key);
    router.refresh();
  }

  function close() {
    setOpen(false);
    setGenerated(null);
    setName("");
  }

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : close())}>
      <DialogTrigger
        render={
          <Button>
            <Plus className="size-4 mr-2" />
            Vytvořit klíč
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {generated ? "Klíč vytvořen" : "Nový API klíč"}
          </DialogTitle>
        </DialogHeader>

        {generated ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Klíč zobrazíme pouze jednou. Uložte si ho na bezpečné místo.
            </p>
            <div className="flex gap-2">
              <Input value={generated} readOnly className="font-mono text-xs" />
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  navigator.clipboard.writeText(generated);
                  toast.success("Zkopírováno");
                }}
              >
                <Copy className="size-4" />
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <Label htmlFor="kname">Jméno (např. „Shoptet eshop“)</Label>
            <Input
              id="kname"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
        )}

        <DialogFooter>
          {generated ? (
            <Button onClick={close}>Zavřít</Button>
          ) : (
            <>
              <Button variant="outline" onClick={close}>
                Zrušit
              </Button>
              <Button onClick={create} disabled={submitting || !name.trim()}>
                {submitting ? "Vytvářím…" : "Vytvořit"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
