import { cn } from "@/lib/utils";
import {
  RECEIVED_INVOICE_STATUS_LABELS,
  type ReceivedInvoiceStatus,
} from "@/types/received-invoice";

const CLASSES: Record<ReceivedInvoiceStatus, string> = {
  draft: "bg-muted text-muted-foreground",
  entered: "bg-amber-100 text-amber-900",
  paid: "bg-emerald-100 text-emerald-900",
  archived: "bg-slate-100 text-slate-700",
  cancelled: "bg-red-100 text-red-900",
};

export function ReceivedInvoiceStatusBadge({
  status,
}: {
  status: ReceivedInvoiceStatus;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        CLASSES[status],
      )}
    >
      {RECEIVED_INVOICE_STATUS_LABELS[status]}
    </span>
  );
}
