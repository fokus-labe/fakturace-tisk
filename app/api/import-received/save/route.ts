import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import {
  RECEIVED_INVOICE_CATEGORIES,
  RECEIVED_PAYMENT_METHODS,
} from "@/lib/validations/supplier";
import { RECEIVED_INVOICE_STATUSES } from "@/lib/validations/received-invoice";

export const runtime = "nodejs";

const invoiceSchema = z.object({
  filename: z.string().optional().nullable(),
  supplier: z.object({
    name: z.string().trim().min(1),
    ico: z
      .string()
      .trim()
      .regex(/^\d{8}$/)
      .optional()
      .nullable()
      .or(z.literal("")),
    dic: z.string().trim().optional().nullable().or(z.literal("")),
    address_street: z.string().optional().nullable(),
    address_city: z.string().optional().nullable(),
    address_zip: z.string().optional().nullable(),
  }),
  supplier_invoice_number: z.string().optional().nullable(),
  issued_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  due_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .nullable(),
  payment_method: z.enum(RECEIVED_PAYMENT_METHODS).default("faktura"),
  category: z.enum(RECEIVED_INVOICE_CATEGORIES).default("ostatni"),
  description: z.string().trim().min(1).max(500),
  amount_no_vat: z.coerce.number().nonnegative(),
  amount_vat: z.coerce.number().nonnegative(),
  amount_total: z.coerce.number().nonnegative(),
  status: z.enum(RECEIVED_INVOICE_STATUSES).default("entered"),
  tokens_input: z.coerce.number().int().nonnegative().optional(),
  tokens_output: z.coerce.number().int().nonnegative().optional(),
});

const batchSchema = z.object({
  invoices: z.array(invoiceSchema).min(1).max(50),
});

function normalizeIco(v: string | null | undefined): string | null {
  if (!v) return null;
  const t = v.trim();
  return t.length === 0 ? null : t;
}

// Sonnet 4.5 pricing — $3 / M input, $15 / M output
function estimateCostUsd(tokensIn: number, tokensOut: number): number {
  return (tokensIn * 3 + tokensOut * 15) / 1_000_000;
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = batchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const results = {
    created: 0,
    failed: 0,
    errors: [] as Array<{
      index: number;
      filename: string | null;
      message: string;
    }>,
    // index = pozice ve vstupním poli invoices; id = vytvořená received_invoice
    createdItems: [] as Array<{ index: number; id: string }>,
  };
  let suppliersCreated = 0;
  let totalTokensIn = 0;
  let totalTokensOut = 0;

  for (let idx = 0; idx < parsed.data.invoices.length; idx++) {
    const inv = parsed.data.invoices[idx];
    totalTokensIn += inv.tokens_input ?? 0;
    totalTokensOut += inv.tokens_output ?? 0;

    try {
      const ico = normalizeIco(inv.supplier.ico);
      let supplierId: string;

      if (ico) {
        const { data: existing } = await supabase
          .from("suppliers")
          .select("id")
          .eq("ico", ico)
          .maybeSingle();
        if (existing) {
          supplierId = existing.id;
        } else {
          const { data: newSupplier, error } = await supabase
            .from("suppliers")
            .insert({
              name: inv.supplier.name,
              ico,
              dic: inv.supplier.dic || null,
              address_street: inv.supplier.address_street || null,
              address_city: inv.supplier.address_city || null,
              address_zip: inv.supplier.address_zip || null,
              created_by: user.id,
            })
            .select("id")
            .single();
          if (error || !newSupplier)
            throw error ?? new Error("Dodavatel insert failed");
          supplierId = newSupplier.id;
          suppliersCreated += 1;
        }
      } else {
        const { data: existing } = await supabase
          .from("suppliers")
          .select("id")
          .eq("name", inv.supplier.name)
          .maybeSingle();
        if (existing) {
          supplierId = existing.id;
        } else {
          const { data: newSupplier, error } = await supabase
            .from("suppliers")
            .insert({
              name: inv.supplier.name,
              dic: inv.supplier.dic || null,
              address_street: inv.supplier.address_street || null,
              address_city: inv.supplier.address_city || null,
              address_zip: inv.supplier.address_zip || null,
              created_by: user.id,
            })
            .select("id")
            .single();
          if (error || !newSupplier)
            throw error ?? new Error("Dodavatel insert failed");
          supplierId = newSupplier.id;
          suppliersCreated += 1;
        }
      }

      // paid_at: hotovost/dobírka se obvykle platí ihned
      const paidImmediately =
        inv.status === "paid" ||
        inv.payment_method === "hotovost" ||
        inv.payment_method === "dobirka";

      const { data: invoice, error: invErr } = await supabase
        .from("received_invoices")
        .insert({
          supplier_id: supplierId,
          supplier_invoice_number: inv.supplier_invoice_number ?? null,
          issued_at: inv.issued_at,
          due_date: inv.due_date ?? null,
          paid_at: paidImmediately ? inv.issued_at : null,
          payment_method: inv.payment_method,
          amount_no_vat: inv.amount_no_vat,
          amount_vat: inv.amount_vat,
          amount_total: inv.amount_total,
          description: inv.description,
          category: inv.category,
          status: paidImmediately ? "paid" : inv.status,
          notes: inv.filename ? `OCR import: ${inv.filename}` : null,
          created_by: user.id,
        })
        .select("id")
        .single();
      if (invErr || !invoice)
        throw invErr ?? new Error("Received invoice insert failed");

      results.created += 1;
      results.createdItems.push({ index: idx, id: invoice.id });
    } catch (err) {
      results.failed += 1;
      const label = `${inv.supplier.name} (${inv.supplier_invoice_number || "bez čísla"})`;
      results.errors.push({
        index: idx,
        filename: inv.filename ?? null,
        message: `${label}: ${err instanceof Error ? err.message : "Neznámá chyba"}`,
      });
    }
  }

  // Audit záznam (best-effort — selhání auditu nesmí shodit save)
  let importId: string | null = null;
  try {
    const estimatedCost =
      totalTokensIn + totalTokensOut > 0
        ? Number(estimateCostUsd(totalTokensIn, totalTokensOut).toFixed(4))
        : null;

    const { data: importRecord, error: auditErr } = await supabase
      .from("invoice_imports")
      .insert({
        imported_by: user.id,
        kind: "received",
        file_count: parsed.data.invoices.length,
        invoice_count_created: results.created,
        invoice_count_failed: results.failed,
        client_count_created: suppliersCreated,
        filenames: parsed.data.invoices.map((i) => i.filename ?? "unknown"),
        errors: results.errors.length > 0 ? results.errors : null,
        total_tokens_input: totalTokensIn || null,
        total_tokens_output: totalTokensOut || null,
        estimated_cost_usd: estimatedCost,
      })
      .select("id")
      .single();

    if (auditErr) {
      console.warn("[import-received/save] audit insert failed:", auditErr.message);
    } else if (importRecord) {
      importId = importRecord.id;
    }
  } catch (err) {
    console.warn("[import-received/save] audit pipeline error:", err);
  }

  return NextResponse.json({ ...results, importId });
}
