import { z } from "zod";

export const RECEIVED_PAYMENT_METHODS = [
  "faktura",
  "hotovost",
  "dodaci_list",
  "dobirka",
] as const;

export const RECEIVED_INVOICE_CATEGORIES = [
  "material",
  "textil",
  "reklamni_predmety",
  "sluzby",
  "potisk",
  "obaly",
  "ostatni",
] as const;

export const supplierSchema = z.object({
  name: z.string().min(1, "Jméno je povinné").max(200),
  ico: z.string().max(20).optional().nullable(),
  dic: z.string().max(20).optional().nullable(),
  address_street: z.string().max(200).optional().nullable(),
  address_city: z.string().max(100).optional().nullable(),
  address_zip: z.string().max(20).optional().nullable(),
  address_country: z.string().max(100).optional().nullable(),
  email: z.string().email("Neplatný email").optional().nullable().or(z.literal("")),
  phone: z.string().max(50).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  default_payment_method: z
    .enum(RECEIVED_PAYMENT_METHODS)
    .optional()
    .nullable()
    .or(z.literal("")),
  default_category: z
    .enum(RECEIVED_INVOICE_CATEGORIES)
    .optional()
    .nullable()
    .or(z.literal("")),
});

export type SupplierInput = z.infer<typeof supplierSchema>;
