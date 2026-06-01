import { z } from "zod";
import { clientSchema } from "./client";

export const ISSUED_PAYMENT_METHODS = [
  "fakturace",
  "hotovost",
  "karta",
  "QR",
] as const;

// VS je v ČR čistě číselný (max 10 číslic). Prázdná hodnota je povolená —
// VS se v konceptu negeneruje a doplní se až později.
export const variableSymbolSchema = z
  .string()
  .trim()
  .regex(/^\d*$/, "Variabilní symbol smí obsahovat jen číslice")
  .max(10, "Variabilní symbol smí mít maximálně 10 číslic")
  .optional()
  .nullable();

export const invoiceItemSchema = z.object({
  description: z.string().trim().min(1, "Popis je povinný").max(500),
  quantity: z.coerce
    .number()
    .positive("Množství musí být kladné")
    .max(999999, "Množství je příliš velké"),
  unit_price_no_vat: z.coerce
    .number()
    .min(0, "Cena nesmí být záporná")
    .max(99999999.99, "Cena je příliš velká"),
  vat_rate: z.coerce.number().min(0).max(100).default(21),
});

export const invoiceRequestSchema = z
  .object({
    client_id: z.string().uuid().optional(),
    new_client: clientSchema.optional(),
    issued_at: z.string().optional(),
    due_date: z.string().optional().nullable(),
    variable_symbol: variableSymbolSchema,
    payment_method: z.enum(ISSUED_PAYMENT_METHODS).optional(),
    short_description: z.string().trim().max(200).optional().nullable(),
    notes: z.string().max(5000).optional().nullable(),
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
      "archived",
      "cancelled",
    ])
    .optional(),
  external_invoice_number: z.string().trim().max(50).optional().nullable(),
  invoice_issued_at: z.string().optional().nullable(),
  variable_symbol: variableSymbolSchema,
  payment_method: z.enum(ISSUED_PAYMENT_METHODS).optional(),
  short_description: z.string().trim().max(200).optional().nullable(),
  action: z.literal("revert").optional(),
});

export type InvoiceStatusUpdateInput = z.infer<typeof invoiceStatusUpdateSchema>;

// Plný edit konceptové faktury — klient, položky, datum, splatnost, VS, atd.
// Povolen jen pro status === "draft" (vynucuje route handler).
export const invoiceEditSchema = z.object({
  action: z.literal("edit"),
  client_id: z.string().uuid(),
  issued_at: z.string().min(1, "Datum vystavení je povinné"),
  due_date: z.string().optional().nullable(),
  variable_symbol: variableSymbolSchema,
  payment_method: z.enum(ISSUED_PAYMENT_METHODS).optional(),
  short_description: z.string().trim().max(200).optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
  items: z
    .array(invoiceItemSchema)
    .min(1, "Faktura musí mít alespoň jednu položku"),
});

export type InvoiceEditInput = z.infer<typeof invoiceEditSchema>;
