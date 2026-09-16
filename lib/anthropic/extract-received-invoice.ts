import { z } from "zod";
import { anthropic, OCR_MODEL } from "./client";
import { buildUserContent } from "./content";
import type { PageSource } from "@/lib/import/server-validate";
import {
  RECEIVED_INVOICE_CATEGORIES,
  RECEIVED_PAYMENT_METHODS,
} from "@/lib/validations/supplier";

// Vyúčtování Shoptet Pay / faktura Zásilkovny obsahují náklad i tržbu zároveň.
export const extractedSettlementSchema = z.object({
  statement_number: z.string().min(1),
  statement_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  // brutto − poplatek = netto
  gross_amount: z.coerce.number(),
  fee_amount: z.coerce.number(),
  net_amount: z.coerce.number(),
});

export const extractedReceivedInvoiceSchema = z.object({
  // typ dokladu: běžná přijatá faktura, nebo vyúčtování obsahující náklad+tržbu
  doc_type: z
    .enum(["invoice", "shoptet_pay", "zasilkovna"])
    .default("invoice"),
  settlement: extractedSettlementSchema.optional().nullable(),
  supplier: z.object({
    name: z.string().optional().nullable(),
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
  supplier_invoice_number: z.string().optional().nullable(),
  issued_at: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .nullable(),
  due_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .nullable(),
  amount_no_vat: z.coerce.number().nonnegative().optional().nullable(),
  amount_vat: z.coerce.number().nonnegative().optional().nullable(),
  amount_total: z.coerce.number().nonnegative().optional().nullable(),
  vat_rate: z.coerce.number().min(0).max(100).optional().nullable(),
  payment_method: z.enum(RECEIVED_PAYMENT_METHODS).default("faktura"),
  category: z.enum(RECEIVED_INVOICE_CATEGORIES).default("ostatni"),
  description: z.string().optional().nullable(),
  confidence: z.enum(["high", "medium", "low"]).default("medium"),
  notes: z.string().optional().nullable(),
});

export type ExtractedReceivedInvoice = z.infer<
  typeof extractedReceivedInvoiceSchema
>;

export interface ReceivedExtractResult {
  extracted: ExtractedReceivedInvoice;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

const SYSTEM_PROMPT = `Jsi expert na čtení českých PŘIJATÝCH faktur (faktury, které dodavatel VYSTAVIL firmě Fokus Labe).
Tvůj úkol: extraktovat strukturovaná data z PDF faktury od dodavatele.

DŮLEŽITÉ:
- Faktura je PŘIJATÁ — DODAVATEL je ten, KDO fakturu vystavil (do "supplier")
- Odběratel je VŽDY Fokus Labe (IČO 44226586) — Fokus Labe NIKDY nedávej do "supplier"
- Vrať VŽDY validní JSON, nic jiného
- IČO = 8 číslic, DIČ = CZ+8-10 číslic
- Datumy ve formátu YYYY-MM-DD
- Pokud něco nelze přečíst, dej null a uveď v 'notes'
- confidence "high" = vše jasné, "medium" = něco nejasné, "low" = mnoho chyb pravděpodobně

ČÁSTKY:
- amount_no_vat = základ bez DPH, amount_vat = DPH, amount_total = celkem k úhradě
- Pokud na faktuře není explicitní rozdělení DPH, dopočítej ze sazby:
  amount_no_vat = amount_total / (1 + vat_rate/100), amount_vat = amount_total - amount_no_vat
  (např. 14938,26 / 1,21 = 12345,67 bez DPH, DPH = 2592,59)

ZPŮSOB PLATBY (payment_method):
- "faktura" = bankovní převod (DEFAULT, pokud není uvedeno jinak)
- "hotovost" = na faktuře "uhrazeno hotově" / "platba hotově"
- "dodaci_list" = je to dodací list bez splatnosti
- "dobirka" = "uhrazeno dobírkou" / zásilka na dobírku

KATEGORIE (category) — odhadni podle položek:
- "material" = materiál, suroviny, papír, barvy
- "textil" = trička, mikiny, čepice, oblečení
- "reklamni_predmety" = propagační předměty, hrnky, tužky, placky
- "sluzby" = služby, práce, doprava, montáž
- "potisk" = potisk, sítotisk, výšivka, gravírování
- "obaly" = krabice, sáčky, obalový materiál
- "ostatni" = vše ostatní (DEFAULT)

TYP DOKLADU (doc_type) — NEJDŘÍV urči, o co jde:
- "invoice" = běžná přijatá faktura od dodavatele (DEFAULT)
- "shoptet_pay" = vyúčtování platební brány Shoptet Pay
- "zasilkovna" = faktura / vyúčtování Zásilkovny (Packeta)

Pokud je to "shoptet_pay" nebo "zasilkovna", vyplň navíc objekt "settlement".
Tyto doklady obsahují ZÁROVEŇ náklad i tržbu — nepleť je do amount_* polí,
ta nech null a vše dej do "settlement". Platí: brutto − poplatek = netto.

SHOPTET PAY (settlement):
- statement_number = číslo výpisu
- statement_date = datum výpisu
- gross_amount = "Příchozí platby celkem" (brutto)
- fee_amount = "Smluvní poplatky" (poplatek)
- net_amount = "Celkem vyplaceno" (netto)
- Výpis o sobě říká, že NENÍ daňovým dokladem — to ale NEznamená, že se nemá
  zaevidovat. Vždy ho zpracuj.

ZÁSILKOVNA (settlement) — POZOR na záměnu tří částek, stojí vedle sebe:
- statement_number = číslo faktury
- statement_date = datum vystavení
- fee_amount = FAKTUROVANÁ ČÁSTKA ZA SLUŽBY vč. DPH (jako náklad patří VŽDY jen
  tahle částka za služby), typicky nejmenší, např. 249,41
- gross_amount = VYBRANÉ DOBÍRKY (brutto), typicky největší, např. 878,00
- net_amount = KOLIK BUDE ZASLÁNO / vyplaceno, např. 628,59
- Ověř si: gross_amount − fee_amount = net_amount (878,00 − 249,41 = 628,59).
- Faktura může být uhrazená zápočtem — to je v pořádku.`;

const USER_PROMPT = `Vytáhni z tohoto dokladu strukturovaná data a vrať VÝHRADNĚ jako JSON object podle této struktury:

{
  "doc_type": "invoice | shoptet_pay | zasilkovna",
  "settlement": {
    "statement_number": "string (číslo výpisu/faktury)",
    "statement_date": "YYYY-MM-DD",
    "gross_amount": number,
    "fee_amount": number,
    "net_amount": number
  } (jen u shoptet_pay/zasilkovna, jinak null),
  "supplier": {
    "name": "string (název dodavatele jak je na faktuře)",
    "ico": "string nebo null",
    "dic": "string nebo null",
    "address_street": "string nebo null",
    "address_city": "string nebo null",
    "address_zip": "string nebo null"
  },
  "supplier_invoice_number": "string nebo null (číslo faktury / variabilní symbol dodavatele)",
  "issued_at": "YYYY-MM-DD (datum vystavení)",
  "due_date": "YYYY-MM-DD nebo null (splatnost)",
  "amount_no_vat": number,
  "amount_vat": number,
  "amount_total": number,
  "vat_rate": number (typicky 21, 12 nebo 0),
  "payment_method": "faktura | hotovost | dodaci_list | dobirka",
  "category": "material | textil | reklamni_predmety | sluzby | potisk | obaly | ostatni",
  "description": "string (krátký popis 3-5 slov, max 50 znaků, např. 'REDDO trička Sparta')",
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

export async function extractReceivedInvoiceFromSources(
  sources: PageSource[],
  multiPageImage = false,
): Promise<ReceivedExtractResult> {
  const response = await anthropic.messages.create({
    model: OCR_MODEL,
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: buildUserContent(sources, USER_PROMPT, multiPageImage),
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

  const extracted = extractedReceivedInvoiceSchema.parse(parsed);

  return {
    extracted,
    usage: {
      input_tokens: response.usage.input_tokens,
      output_tokens: response.usage.output_tokens,
    },
  };
}
