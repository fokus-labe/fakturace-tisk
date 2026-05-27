import { z } from "zod";
import {
  RECEIVED_INVOICE_CATEGORIES,
  RECEIVED_PAYMENT_METHODS,
} from "./supplier";

export const RECEIVED_INVOICE_STATUSES = [
  "draft",
  "entered",
  "paid",
  "archived",
  "cancelled",
] as const;

export const receivedInvoiceSchema = z.object({
  supplier_id: z.string().uuid("Vyber dodavatele"),
  supplier_invoice_number: z.string().trim().max(100).optional().nullable(),
  issued_at: z.string().min(1, "Datum vystavení je povinné"),
  due_date: z.string().optional().nullable(),
  paid_at: z.string().optional().nullable(),
  payment_method: z.enum(RECEIVED_PAYMENT_METHODS),
  amount_no_vat: z.coerce
    .number()
    .min(0, "Částka nesmí být záporná")
    .max(99999999.99, "Částka je příliš velká"),
  amount_vat: z.coerce
    .number()
    .min(0, "DPH nesmí být záporné")
    .max(99999999.99, "DPH je příliš velké"),
  amount_total: z.coerce
    .number()
    .min(0, "Celková částka je povinná")
    .max(99999999.99, "Celková částka je příliš velká"),
  description: z.string().trim().min(1, "Popis je povinný").max(500),
  category: z.enum(RECEIVED_INVOICE_CATEGORIES),
  pdf_url: z.string().optional().nullable(),
  status: z.enum(RECEIVED_INVOICE_STATUSES),
  notes: z.string().max(5000).optional().nullable(),
});

export type ReceivedInvoiceInput = z.input<typeof receivedInvoiceSchema>;
export type ReceivedInvoiceOutput = z.output<typeof receivedInvoiceSchema>;

export const receivedInvoiceUpdateSchema = receivedInvoiceSchema.partial();
export type ReceivedInvoiceUpdateInput = z.infer<
  typeof receivedInvoiceUpdateSchema
>;
