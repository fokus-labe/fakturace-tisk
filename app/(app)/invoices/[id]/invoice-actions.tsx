"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Download, Mail, Check, Ban, FileCheck } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { InvoiceStatus } from "@/types/invoice";

interface Props {
  invoiceId: string;
  status: InvoiceStatus;
  externalInvoiceNumber: string | null;
}

export function InvoiceActions({
  invoiceId,
  status,
  externalInvoiceNumber,
}: Props) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [issuedOpen, setIssuedOpen] = useState(false);
  const [extNumber, setExtNumber] = useState(externalInvoiceNumber ?? "");

  async function patch(body: Record<string, unknown>, label: string) {
    setPending(label);
    const res = await fetch(`/api/invoice-requests/${invoiceId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setPending(null);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      toast.error("Operace selhala", { description: j?.error });
      return;
    }
    toast.success("Hotovo");
    router.refresh();
  }

  async function notify() {
    setPending("notify");
    const res = await fetch(
      `/api/invoice-requests/${invoiceId}/notify`,
      { method: "POST" },
    );
    setPending(null);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      toast.error("Email se nepodařilo odeslat", { description: j?.error });
      return;
    }
    toast.success("Odesláno Petrovi", {
      description: "Email s PDF byl odeslán účetnímu.",
    });
    router.refresh();
  }

  async function saveIssued() {
    if (!extNumber.trim()) {
      toast.error("Zadej číslo faktury");
      return;
    }
    await patch(
      { status: "invoice_issued", external_invoice_number: extNumber.trim() },
      "issued",
    );
    setIssuedOpen(false);
  }

  return (
    <div className="flex flex-wrap gap-2">
      <a
        href={`/api/invoice-requests/${invoiceId}/pdf`}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
      >
        <Download className="size-4 mr-2" />
        Stáhnout PDF
      </a>

      <Button
        size="sm"
        onClick={notify}
        disabled={pending === "notify" || status === "cancelled"}
      >
        <Mail className="size-4 mr-2" />
        {pending === "notify" ? "Odesílám…" : "Odeslat Petrovi"}
      </Button>

      <Dialog open={issuedOpen} onOpenChange={setIssuedOpen}>
        <DialogTrigger
          render={
            <Button
              size="sm"
              variant="outline"
              disabled={
                status === "cancelled" ||
                status === "paid" ||
                status === "draft"
              }
            >
              <FileCheck className="size-4 mr-2" />
              Označit jako vystavená
            </Button>
          }
        />
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Označit jako vystavená</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="ext">Číslo faktury od účetní</Label>
            <Input
              id="ext"
              value={extNumber}
              onChange={(e) => setExtNumber(e.target.value)}
              placeholder="např. 2026-0123"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIssuedOpen(false)}>
              Zrušit
            </Button>
            <Button onClick={saveIssued} disabled={pending === "issued"}>
              Uložit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Button
        size="sm"
        variant="outline"
        disabled={
          pending === "paid" ||
          status === "paid" ||
          status === "cancelled" ||
          status === "draft"
        }
        onClick={() => patch({ status: "paid" }, "paid")}
      >
        <Check className="size-4 mr-2" />
        Označit zaplacenou
      </Button>

      <Button
        size="sm"
        variant="ghost"
        disabled={pending === "cancel" || status === "cancelled"}
        onClick={() => {
          if (confirm("Opravdu zrušit?"))
            patch({ status: "cancelled" }, "cancel");
        }}
      >
        <Ban className="size-4 mr-2" />
        Zrušit
      </Button>
    </div>
  );
}
