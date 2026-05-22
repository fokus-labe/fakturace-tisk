import { z } from "zod";
import { clientSchema } from "./client";

export const invoiceItemSchema = z.object({
  description: z.string().min(1, "Popis je povinný").max(500),
  quantity: z.coerce.number().positive("Množství musí být kladné"),
  unit_price_no_vat: z.coerce.number().min(0, "Cena nesmí být záporná"),
  vat_rate: z.coerce.number().min(0).max(100).default(21),
});

export const invoiceRequestSchema = z
  .object({
    client_id: z.string().uuid().optional(),
    new_client: clientSchema.optional(),
    issued_at: z.string().optional(),
    due_date: z.string().optional().nullable(),
    variable_symbol: z.string().optional().nullable(),
    payment_method: z.string().optional().nullable(),
    notes: z.string().max(2000).optional().nullable(),
    items: z.array(invoiceItemSchema).min(1, "Faktura musí mít alespoň jednu položku"),
    source: z.enum(["manual", "eshop_api"]).default("manual"),
    source_reference: z.string().optional().nullable(),
    source_metadata: z.record(z.string(), z.unknown()).optional().nullable(),
  })
  .refine(
    (v) => !!v.client_id || !!v.new_client,
    "Vyber existujícího klienta nebo zadej nového",
  );

export type InvoiceRequestInput = z.infer<typeof invoiceRequestSchema>;
export type InvoiceItemInput = z.infer<typeof invoiceItemSchema>;

export const invoiceStatusUpdateSchema = z.object({
  status: z
    .enum([
      "draft",
      "sent_to_accountant",
      "invoice_issued",
      "paid",
      "archived",
      "cancelled",
    ])
    .optional(),
  external_invoice_number: z.string().max(50).optional().nullable(),
  paid_at: z.string().optional().nullable(),
});

export type InvoiceStatusUpdateInput = z.infer<typeof invoiceStatusUpdateSchema>;
