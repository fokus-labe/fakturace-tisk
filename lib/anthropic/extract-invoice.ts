import { z } from "zod";
import { anthropic, OCR_MODEL } from "./client";

export const extractedInvoiceSchema = z.object({
  client: z.object({
    name: z.string().min(1),
    ico: z
      .string()
      .regex(/^\d{8}$/)
      .optional()
      .nullable(),
    dic: z.string().optional().nullable(),
    address_street: z.string().optional().nullable(),
    address_city: z.string().optional().nullable(),
    address_zip: z.string().optional().nullable(),
  }),
  invoice: z.object({
    external_invoice_number: z.string().optional().nullable(),
    variable_symbol: z.string().optional().nullable(),
    issued_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    due_date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional()
      .nullable(),
    payment_method: z
      .enum(["fakturace", "hotovost", "karta", "QR"])
      .default("fakturace"),
  }),
  items: z
    .array(
      z.object({
        description: z.string().min(1),
        quantity: z.coerce.number().positive(),
        unit_price_no_vat: z.coerce.number().nonnegative(),
        vat_rate: z.coerce.number().min(0).max(100),
      }),
    )
    .min(1),
  totals: z.object({
    no_vat: z.coerce.number(),
    vat: z.coerce.number(),
    with_vat: z.coerce.number(),
  }),
  confidence: z.enum(["high", "medium", "low"]).default("medium"),
  notes: z.string().optional().nullable(),
});

export type ExtractedInvoice = z.infer<typeof extractedInvoiceSchema>;

export interface ExtractResult {
  extracted: ExtractedInvoice;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

const SYSTEM_PROMPT = `Jsi expert na čtení českých vydávaných faktur (faktury, které někdo VYSTAVIL).
Tvůj úkol: extraktovat strukturovaná data z PDF faktury.

DŮLEŽITÉ:
- Faktura je VYDANÁ Fokus Labe (vystavovatel) — KLIENT je ten, KOMU se fakturuje (odběratel)
- Vrať VŽDY validní JSON, nic jiného
- IČO = 8 číslic, DIČ = CZ+8-10 číslic
- Datumy ve formátu YYYY-MM-DD
- Pokud něco nelze přečíst, dej null a uveď v 'notes'
- confidence "high" = vše jasné, "medium" = něco nejasné, "low" = mnoho chyb pravděpodobně

Fokus Labe údaje (vystavovatel, NEDÁVEJ ho do "client"):
- IČO: 44226586
- DIČ: CZ44226586
- Stroupežnického 1372/9, 400 01 Ústí nad Labem`;

const USER_PROMPT = `Vytáhni z této faktury strukturovaná data a vrať VÝHRADNĚ jako JSON object podle této struktury:

{
  "client": {
    "name": "string",
    "ico": "string nebo null",
    "dic": "string nebo null",
    "address_street": "string nebo null",
    "address_city": "string nebo null",
    "address_zip": "string nebo null"
  },
  "invoice": {
    "external_invoice_number": "string nebo null (číslo faktury)",
    "variable_symbol": "string nebo null",
    "issued_at": "YYYY-MM-DD (datum vystavení)",
    "due_date": "YYYY-MM-DD nebo null",
    "payment_method": "fakturace | hotovost | karta | QR"
  },
  "items": [
    { "description": "string", "quantity": number, "unit_price_no_vat": number, "vat_rate": number }
  ],
  "totals": { "no_vat": number, "vat": number, "with_vat": number },
  "confidence": "high | medium | low",
  "notes": "string nebo null (poznámka pro lidskou kontrolu)"
}

VRAŤ POUZE JSON, žádný markdown, žádný text okolo.`;

function stripCodeFence(text: string): string {
  return text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
}

export async function extractInvoiceFromPdf(
  pdfBase64: string,
): Promise<ExtractResult> {
  const response = await anthropic.messages.create({
    model: OCR_MODEL,
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "document",
            source: {
              type: "base64",
              media_type: "application/pdf",
              data: pdfBase64,
            },
          },
          { type: "text", text: USER_PROMPT },
        ],
      },
    ],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Claude nevrátil žádný textový obsah");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripCodeFence(textBlock.text));
  } catch {
    throw new Error(
      "Claude vrátil odpověď, která není validní JSON. Zkus to znovu.",
    );
  }

  const extracted = extractedInvoiceSchema.parse(parsed);

  return {
    extracted,
    usage: {
      input_tokens: response.usage.input_tokens,
      output_tokens: response.usage.output_tokens,
    },
  };
}
