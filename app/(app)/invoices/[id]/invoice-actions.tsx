"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Download,
  Mail,
  Check,
  Ban,
  FileCheck,
  ClipboardCopy,
  FileText,
  Send,
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

interface PreparedPayload {
  pdf_url: string;
  mailto_link: string;
  subject: string;
  body: string;
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
  const [prepared, setPrepared] = useState<PreparedPayload | null>(null);

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
      return false;
    }
    toast.success("Hotovo");
    router.refresh();
    return true;
  }

  async function prepare() {
    setPending("prepare");
    const res = await fetch(
      `/api/invoice-requests/${invoiceId}/prepare`,
      { method: "POST" },
    );
    setPending(null);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      toast.error("Podklady se nepodařilo připravit", { description: j?.error });
      return;
    }
    const data = (await res.json()) as PreparedPayload;
    setPrepared(data);
    toast.success("Podklady připraveny", {
      description: "PDF je v úložišti, e-mail je předvyplněný.",
    });
    router.refresh();
  }

  async function markAsSent() {
    const ok = await patch({ status: "sent_to_accountant" }, "sent");
    if (ok) {
      setPrepared(null);
      toast.success("Označeno jako odesláno");
    }
  }

  async function copyText(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} zkopírováno`);
    } catch {
      toast.error("Kopírování selhalo");
    }
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
    <div className="space-y-4">
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
          onClick={prepare}
          disabled={
            pending === "prepare" ||
            status === "cancelled" ||
            status !== "draft"
          }
        >
          <FileText className="size-4 mr-2" />
          {pending === "prepare" ? "Připravuji…" : "Připravit podklady"}
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

      {prepared ? (
        <Card className="border-primary/40 bg-primary/5">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="size-4" />
              Podklady jsou připravené
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <p className="text-muted-foreground">Pošli e-mail Petrovi:</p>

            <ol className="space-y-3 list-decimal list-inside">
              <li className="flex items-center justify-between gap-3 flex-wrap">
                <span>Otevři PDF a stáhni si ho</span>
                <a
                  href={`/api/invoice-requests/${invoiceId}/pdf`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(
                    buttonVariants({ variant: "outline", size: "sm" }),
                  )}
                >
                  <Download className="size-4 mr-2" />
                  Stáhnout PDF
                </a>
              </li>
              <li className="flex items-center justify-between gap-3 flex-wrap">
                <span>Otevři předvyplněný e-mail</span>
                <a
                  href={prepared.mailto_link}
                  className={cn(buttonVariants({ size: "sm" }))}
                >
                  <Mail className="size-4 mr-2" />
                  Otevřít v e-mailu
                </a>
              </li>
              <li>Připni PDF a odešli e-mail</li>
              <li className="flex items-center justify-between gap-3 flex-wrap">
                <span>Potvrď odeslání</span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={markAsSent}
                  disabled={pending === "sent"}
                >
                  <Send className="size-4 mr-2" />
                  Označit jako odesláno
                </Button>
              </li>
            </ol>

            <p className="text-xs text-muted-foreground">
              Otevře se ve vašem default e-mail klientovi (Gmail/Outlook). Pokud
              nefunguje, použijte tlačítka „Zkopírovat předmět“ a „Zkopírovat
              tělo“.
            </p>

            <div className="flex flex-wrap gap-2 pt-2 border-t">
              <span className="text-xs text-muted-foreground self-center">
                Alternativně:
              </span>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => copyText(prepared.subject, "Předmět")}
              >
                <ClipboardCopy className="size-4 mr-2" />
                Zkopírovat předmět
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => copyText(prepared.body, "Tělo")}
              >
                <ClipboardCopy className="size-4 mr-2" />
                Zkopírovat tělo
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
