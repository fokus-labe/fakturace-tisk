import "server-only";
import { renderToBuffer } from "@react-pdf/renderer";
import { InvoicePdf } from "@/components/invoice/invoice-pdf";
import type { IssuerData } from "@/lib/venues/venue-issuer";
import type { Client, InvoiceItem, InvoiceRequest } from "@/types/invoice";

export async function renderInvoicePdf(args: {
  invoice: InvoiceRequest;
  client: Client;
  items: InvoiceItem[];
  issuer?: IssuerData;
}): Promise<Buffer> {
  const doc = (
    <InvoicePdf
      invoice={args.invoice}
      client={args.client}
      items={args.items}
      issuer={args.issuer}
    />
  );
  return await renderToBuffer(doc);
}
