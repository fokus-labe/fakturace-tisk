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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  RECEIVED_INVOICE_CATEGORY_LABELS,
  RECEIVED_PAYMENT_METHOD_LABELS,
  type ReceivedInvoiceCategory,
  type ReceivedPaymentMethod,
} from "@/types/received-invoice";
import type { Supplier } from "@/types/supplier";

const PAYMENT_OPTIONS = (
  Object.keys(RECEIVED_PAYMENT_METHOD_LABELS) as ReceivedPaymentMethod[]
).map((v) => ({ value: v, label: RECEIVED_PAYMENT_METHOD_LABELS[v] }));

const CATEGORY_OPTIONS = (
  Object.keys(RECEIVED_INVOICE_CATEGORY_LABELS) as ReceivedInvoiceCategory[]
).map((v) => ({ value: v, label: RECEIVED_INVOICE_CATEGORY_LABELS[v] }));

interface SupplierCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (supplier: Supplier) => void;
}

export function SupplierCreateDialog({
  open,
  onOpenChange,
  onCreated,
}: SupplierCreateDialogProps) {
  const [submitting, setSubmitting] = useState(false);
  const [name, setName] = useState("");
  const [ico, setIco] = useState("");
  const [email, setEmail] = useState("");
  const [defaultPayment, setDefaultPayment] =
    useState<ReceivedPaymentMethod>("faktura");
  const [defaultCategory, setDefaultCategory] =
    useState<ReceivedInvoiceCategory>("ostatni");

  function reset() {
    setName("");
    setIco("");
    setEmail("");
    setDefaultPayment("faktura");
    setDefaultCategory("ostatni");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Vyplň jméno dodavatele");
      return;
    }
    setSubmitting(true);
    const res = await fetch("/api/suppliers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        ico: ico.trim() || null,
        email: email.trim() || null,
        default_payment_method: defaultPayment,
        default_category: defaultCategory,
      }),
    });
    setSubmitting(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      toast.error("Vytvoření selhalo", { description: j?.error });
      return;
    }
    const json = await res.json();
    toast.success("Dodavatel vytvořen a vybrán");
    reset();
    onCreated(json.data as Supplier);
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
          <DialogTitle>Nový dodavatel</DialogTitle>
          <DialogDescription>
            Dodavatel se uloží a automaticky vybere ve formuláři.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="sc-name">Název *</Label>
            <Input
              id="sc-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="sc-ico">IČO</Label>
              <Input
                id="sc-ico"
                value={ico}
                onChange={(e) => setIco(e.target.value)}
                className="font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sc-email">Email</Label>
              <Input
                id="sc-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Default způsob platby</Label>
              <Select
                value={defaultPayment}
                onValueChange={(v) =>
                  setDefaultPayment((v ?? "faktura") as ReceivedPaymentMethod)
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue>
                    {(value: string | null) =>
                      PAYMENT_OPTIONS.find((o) => o.value === value)?.label ??
                      "Faktura"
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Default kategorie</Label>
              <Select
                value={defaultCategory}
                onValueChange={(v) =>
                  setDefaultCategory(
                    (v ?? "ostatni") as ReceivedInvoiceCategory,
                  )
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue>
                    {(value: string | null) =>
                      CATEGORY_OPTIONS.find((o) => o.value === value)?.label ??
                      "Ostatní"
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {CATEGORY_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
