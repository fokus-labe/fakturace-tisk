import { z } from "zod";

export const clientSchema = z.object({
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
});

export type ClientInput = z.infer<typeof clientSchema>;
