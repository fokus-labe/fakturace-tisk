import { z } from "zod";
import { ISSUED_PAYMENT_METHODS } from "@/lib/validations/invoice";

export const invoiceFormSchema = z.object({
  client_id: z.string().uuid().optional().or(z.literal("")),
  new_client_name: z.string().optional(),
  new_client_ico: z.string().optional(),
  new_client_dic: z.string().optional(),
  new_client_email: z.string().optional(),
  new_client_street: z.string().optional(),
  new_client_city: z.string().optional(),
  new_client_zip: z.string().optional(),
  issued_at: z.string().min(1, "Datum vystavení je povinné"),
  due_date: z.string().optional(),
  variable_symbol: z.string().optional(),
  payment_method: z.enum(ISSUED_PAYMENT_METHODS).optional(),
  short_description: z.string().optional(),
  notes: z.string().optional(),
  items: z
    .array(
      z.object({
        description: z.string().min(1, "Popis je povinný"),
        quantity: z.coerce.number().positive("Množství musí být kladné"),
        unit_price_no_vat: z.coerce.number().min(0, "Cena nesmí být záporná"),
        vat_rate: z.coerce.number().min(0).max(100),
      }),
    )
    .min(1, "Faktura musí mít alespoň jednu položku"),
});

export type InvoiceFormInput = z.input<typeof invoiceFormSchema>;
export type InvoiceFormOutput = z.output<typeof invoiceFormSchema>;
export type InvoiceFormValues = InvoiceFormInput;
