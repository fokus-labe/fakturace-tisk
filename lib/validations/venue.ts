import { z } from "zod";

const optionalText = (max: number) =>
  z.string().trim().max(max).optional().nullable().or(z.literal(""));

export const venueSchema = z.object({
  slug: z
    .string()
    .trim()
    .min(1, "Slug je povinný")
    .max(60)
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "Slug smí obsahovat jen malá písmena, číslice a pomlčky",
    ),
  name: z.string().trim().min(1, "Název je povinný").max(120),
  legal_name: z.string().trim().min(1, "Právní název je povinný").max(200),
  ico: z
    .string()
    .trim()
    .regex(/^\d{8}$/, "IČO musí mít 8 číslic"),
  dic: z
    .string()
    .trim()
    .regex(/^CZ\d{8,10}$/, "DIČ musí být ve formátu CZ + 8–10 číslic")
    .optional()
    .nullable()
    .or(z.literal("")),
  address_street: optionalText(200),
  address_city: optionalText(100),
  address_zip: optionalText(20),
  address_country: optionalText(100),
  email: z.string().trim().email("Neplatný email").optional().nullable().or(z.literal("")),
  phone: optionalText(50),
  bank_account: optionalText(50),
  iban: optionalText(50),
  data_box: optionalText(20),
  logo_url: optionalText(500),
  brand_color: z
    .string()
    .trim()
    .regex(/^#[0-9A-Fa-f]{6}$/, "Barva musí být hex, např. #2563EB")
    .optional()
    .nullable()
    .or(z.literal("")),
  active: z.boolean().optional(),
});

export type VenueInput = z.infer<typeof venueSchema>;

export const venueUpdateSchema = venueSchema.partial();
export type VenueUpdateInput = z.infer<typeof venueUpdateSchema>;
