import { Badge } from "@/components/ui/badge";
import {
  RECEIVED_INVOICE_STATUS_LABELS,
  type ReceivedInvoiceStatus,
} from "@/types/received-invoice";

const VARIANTS: Record<
  ReceivedInvoiceStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  draft: "outline",
  entered: "secondary",
  paid: "default",
  archived: "secondary",
  cancelled: "destructive",
};

export function ReceivedInvoiceStatusBadge({
  status,
}: {
  status: ReceivedInvoiceStatus;
}) {
  return (
    <Badge variant={VARIANTS[status]}>
      {RECEIVED_INVOICE_STATUS_LABELS[status]}
    </Badge>
  );
}
