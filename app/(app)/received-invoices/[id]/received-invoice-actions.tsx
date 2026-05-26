"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Archive, Ban, Check, FileCheck } from "lucide-react";
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
import { formatDateInput } from "@/lib/utils/format";
import type { ReceivedInvoiceStatus } from "@/types/received-invoice";

interface Props {
  invoiceId: string;
  status: ReceivedInvoiceStatus;
  paidAt: string | null;
}

export function ReceivedInvoiceActions({
  invoiceId,
  status,
  paidAt,
}: Props) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [paidOpen, setPaidOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [paidDate, setPaidDate] = useState(
    paidAt ?? formatDateInput(new Date()),
  );

  async function patch(body: Record<string, unknown>, label: string) {
    setPending(label);
    const res = await fetch(`/api/received-invoices/${invoiceId}`, {
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

  const canEnter = status === "draft";
  const canPay = status === "entered";
  const canArchive = status === "paid";
  const canCancel = status !== "cancelled" && status !== "archived";

  return (
    <div className="flex flex-wrap gap-2">
      {canEnter ? (
        <Button
          size="sm"
          variant="outline"
          disabled={pending === "entered"}
          onClick={async () => {
            const ok = await patch({ status: "entered" }, "entered");
            if (ok) toast.success("Faktura zaevidována");
          }}
        >
          <FileCheck className="size-4 mr-2" />
          Označit jako zaevidované
        </Button>
      ) : null}

      {canPay ? (
        <Dialog open={paidOpen} onOpenChange={setPaidOpen}>
          <DialogTrigger
            render={
              <Button size="sm" variant="outline">
                <Check className="size-4 mr-2" />
                Označit jako zaplacené
              </Button>
            }
          />
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Faktura zaplacena</DialogTitle>
            </DialogHeader>
            <div className="space-y-1.5">
              <Label htmlFor="paid-date">Datum platby *</Label>
              <Input
                id="paid-date"
                type="date"
                value={paidDate}
                onChange={(e) => setPaidDate(e.target.value)}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setPaidOpen(false)}>
                Zrušit
              </Button>
              <Button
                disabled={pending === "paid"}
                onClick={async () => {
                  if (!paidDate) {
                    toast.error("Zadej datum platby");
                    return;
                  }
                  const ok = await patch(
                    { status: "paid", paid_at: paidDate },
                    "paid",
                  );
                  if (ok) {
                    setPaidOpen(false);
                    toast.success("Faktura označena jako zaplacená");
                  }
                }}
              >
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
              <Button
                disabled={pending === "archived"}
                onClick={async () => {
                  const ok = await patch({ status: "archived" }, "archived");
                  if (ok) {
                    setArchiveOpen(false);
                    toast.success("Faktura archivována");
                  }
                }}
              >
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
          onClick={async () => {
            if (!confirm("Opravdu zrušit?")) return;
            const ok = await patch({ status: "cancelled" }, "cancel");
            if (ok) toast.success("Faktura zrušena");
          }}
        >
          <Ban className="size-4 mr-2" />
          Zrušit
        </Button>
      ) : null}
    </div>
  );
}
