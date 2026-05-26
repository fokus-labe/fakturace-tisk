"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Client } from "@/types/invoice";

interface ClientCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (client: Client) => void;
}

export function ClientCreateDialog({
  open,
  onOpenChange,
  onCreated,
}: ClientCreateDialogProps) {
  const [submitting, setSubmitting] = useState(false);
  const [name, setName] = useState("");
  const [ico, setIco] = useState("");
  const [dic, setDic] = useState("");
  const [email, setEmail] = useState("");
  const [street, setStreet] = useState("");
  const [city, setCity] = useState("");
  const [zip, setZip] = useState("");

  function reset() {
    setName("");
    setIco("");
    setDic("");
    setEmail("");
    setStreet("");
    setCity("");
    setZip("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Vyplň jméno klienta");
      return;
    }
    setSubmitting(true);
    const res = await fetch("/api/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        ico: ico.trim() || null,
        dic: dic.trim() || null,
        email: email.trim() || null,
        address_street: street.trim() || null,
        address_city: city.trim() || null,
        address_zip: zip.trim() || null,
        address_country: "Česká republika",
      }),
    });
    setSubmitting(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      toast.error("Vytvoření selhalo", { description: j?.error });
      return;
    }
    const json = await res.json();
    toast.success("Klient vytvořen a vybrán");
    reset();
    onCreated(json.data as Client);
    onOpenChange(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nový klient</DialogTitle>
          <DialogDescription>
            Klient se uloží a automaticky vybere ve formuláři faktury.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="cc-name">Název *</Label>
            <Input
              id="cc-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="cc-ico">IČO</Label>
              <Input
                id="cc-ico"
                value={ico}
                onChange={(e) => setIco(e.target.value)}
                className="font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cc-dic">DIČ</Label>
              <Input
                id="cc-dic"
                value={dic}
                onChange={(e) => setDic(e.target.value)}
                className="font-mono"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cc-email">Email</Label>
            <Input
              id="cc-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cc-street">Ulice</Label>
            <Input
              id="cc-street"
              value={street}
              onChange={(e) => setStreet(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="cc-zip">PSČ</Label>
              <Input
                id="cc-zip"
                value={zip}
                onChange={(e) => setZip(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cc-city">Město</Label>
              <Input
                id="cc-city"
                value={city}
                onChange={(e) => setCity(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Zrušit
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="size-4 mr-2 animate-spin" />
                  Vytvářím…
                </>
              ) : (
                "Vytvořit a vybrat"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
