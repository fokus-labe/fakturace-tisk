import { Badge } from "@/components/ui/badge";
import type { InvoiceStatus } from "@/types/invoice";

const meta: Record<
  InvoiceStatus,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  draft: { label: "Koncept", variant: "outline" },
  sent_to_accountant: { label: "U účetní", variant: "secondary" },
  invoice_issued: { label: "Vystavená", variant: "default" },
  archived: { label: "Archivovaná", variant: "secondary" },
  cancelled: { label: "Zrušená", variant: "destructive" },
};

export function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  const m = meta[status];
  return <Badge variant={m.variant}>{m.label}</Badge>;
}
