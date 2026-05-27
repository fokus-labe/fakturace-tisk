"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Download,
  Mail,
  Ban,
  FileCheck,
  ClipboardCopy,
  FileText,
  Send,
  Archive,
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
import { DeleteButton } from "@/components/ui/delete-button";
import {
  DatePicker,
  dateToIso,
  isoToDate,
} from "@/components/ui/date-picker";
import { formatDateInput } from "@/lib/utils/format";
import type { InvoiceStatus } from "@/types/invoice";

interface Props {
  invoiceId: string;
  status: InvoiceStatus;
  externalInvoiceNumber: string | null;
  invoiceIssuedAt: string | null;
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
  invoiceIssuedAt,
}: Props) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [issuedOpen, setIssuedOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [extNumber, setExtNumber] = useState(externalInvoiceNumber ?? "");
  const [issuedDate, setIssuedDate] = useState(
    invoiceIssuedAt ?? formatDateInput(new Date()),
  );
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
    if (!issuedDate) {
      toast.error("Zadej datum vystavení");
      return;
    }
    const ok = await patch(
      {
        status: "invoice_issued",
        external_invoice_number: extNumber.trim(),
        invoice_issued_at: issuedDate,
      },
      "issued",
    );
    if (ok) {
      setIssuedOpen(false);
      toast.success(`Faktura ${extNumber.trim()} zaznamenána`);
    }
  }

  async function archive() {
    const ok = await patch({ status: "archived" }, "archive");
    if (ok) {
      setArchiveOpen(false);
      toast.success("Faktura archivována");
    }
  }

  const canPrepare = status === "draft";
  const canMarkIssued = status === "sent_to_accountant";
  const canArchive = status === "invoice_issued";
  const canCancel = status !== "cancelled" && status !== "archived";
  // Smazat: jen draft, sent_to_accountant, cancelled — NIKDY invoice_issued / archived
  const canDelete =
    status === "draft" ||
    status === "sent_to_accountant" ||
    status === "cancelled";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <a
          href={`/api/invoice-requests/${invoiceId}/pdf`}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
        >
          <Download className="size-4 mr-2" />
          <span className="hidden sm:inline">Stáhnout PDF</span>
          <span className="sm:hidden">PDF</span>
        </a>

        {canPrepare ? (
          <Button
            size="sm"
            onClick={prepare}
            disabled={pending === "prepare"}
          >
            <FileText className="size-4 mr-2" />
            {pending === "prepare" ? "Připravuji…" : "Připravit podklady"}
          </Button>
        ) : null}

        {canMarkIssued ? (
          <Dialog open={issuedOpen} onOpenChange={setIssuedOpen}>
            <DialogTrigger
              render={
                <Button size="sm" variant="outline">
                  <FileCheck className="size-4 mr-2" />
                  Označit jako vystavená
                </Button>
              }
            />
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Faktura vystavena</DialogTitle>
              </DialogHeader>
              <p className="text-sm text-muted-foreground">
                Petr fakturu vystavil v účetním softwaru. Zaznamenej její údaje:
              </p>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="ext">Číslo faktury *</Label>
                  <Input
                    id="ext"
                    value={extNumber}
                    onChange={(e) => setExtNumber(e.target.value)}
                    placeholder="např. FV20260001"
                  />
                  <p className="text-xs text-muted-foreground">
                    Příklad: FV20260001
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="issued-date">Datum vystavení *</Label>
                  <DatePicker
                    value={isoToDate(issuedDate)}
                    onChange={(d) => setIssuedDate(dateToIso(d))}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIssuedOpen(false)}>
                  Zrušit
                </Button>
                <Button onClick={saveIssued} disabled={pending === "issued"}>
                  Potvrdit
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        ) : null}

        {canArchive ? (
          <Dialog open={archiveOpen} onOpenChange={setArchiveOpen}>
            <DialogTrigger
              render={
                <Button size="sm" variant="outline">
                  <Archive className="size-4 mr-2" />
                  Archivovat
                </Button>
              }
            />
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Archivovat fakturu?</DialogTitle>
              </DialogHeader>
              <p className="text-sm text-muted-foreground">
                Archivované faktury jsou v seznamu defaultně skryté.
              </p>
              <DialogFooter>
                <Button variant="outline" onClick={() => setArchiveOpen(false)}>
                  Zrušit
                </Button>
                <Button onClick={archive} disabled={pending === "archive"}>
                  Archivovat
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        ) : null}

        {canCancel ? (
          <Button
            size="sm"
            variant="ghost"
            disabled={pending === "cancel"}
            onClick={() => {
              if (confirm("Opravdu zrušit?"))
                patch({ status: "cancelled" }, "cancel");
            }}
          >
            <Ban className="size-4 mr-2" />
            Zrušit
          </Button>
        ) : null}

        {canDelete ? (
          <div className="ml-auto">
            <DeleteButton
              endpoint={`/api/invoice-requests/${invoiceId}`}
              redirectTo="/invoices"
              description="Faktura bude trvale odstraněna ze systému včetně PDF podkladu. Tato akce je nevratná."
              successMessage="Faktura smazána"
            />
          </div>
        ) : null}
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
