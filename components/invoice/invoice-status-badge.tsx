import { cn } from "@/lib/utils";
import type { InvoiceStatus } from "@/types/invoice";

const STYLES: Record<InvoiceStatus, { label: string; classes: string }> = {
  draft: {
    label: "Koncept",
    classes: "bg-muted text-muted-foreground",
  },
  sent_to_accountant: {
    label: "U účetní",
    classes: "bg-amber-100 text-amber-900",
  },
  invoice_issued: {
    label: "Vystaveno",
    classes: "bg-blue-100 text-blue-900",
  },
  archived: {
    label: "Archiv",
    classes: "bg-slate-100 text-slate-700",
  },
  cancelled: {
    label: "Zrušeno",
    classes: "bg-red-100 text-red-900",
  },
};

export function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  const s = STYLES[status];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        s.classes,
      )}
    >
      {s.label}
    </span>
  );
}
