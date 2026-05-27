import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { ISSUED_PAYMENT_METHODS } from "@/lib/validations/invoice";

export const runtime = "nodejs";

const itemSchema = z.object({
  description: z.string().trim().min(1),
  quantity: z.coerce.number().positive(),
  unit_price_no_vat: z.coerce.number().nonnegative(),
  vat_rate: z.coerce.number().min(0).max(100),
});

const invoiceSchema = z.object({
  client: z.object({
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
  external_invoice_number: z.string().optional().nullable(),
  variable_symbol: z.string().optional().nullable(),
  issued_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  due_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .nullable(),
  payment_method: z.enum(ISSUED_PAYMENT_METHODS).default("fakturace"),
  items: z.array(itemSchema).min(1),
});

const batchSchema = z.object({
  invoices: z.array(invoiceSchema).min(1).max(50),
});

function normalizeIco(v: string | null | undefined): string | null {
  if (!v) return null;
  const t = v.trim();
  return t.length === 0 ? null : t;
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
    errors: [] as Array<{ index: number; message: string }>,
    createdIds: [] as string[],
  };

  for (let idx = 0; idx < parsed.data.invoices.length; idx++) {
    const inv = parsed.data.invoices[idx];
    try {
      // 1) Najdi nebo vytvoř klienta
      const ico = normalizeIco(inv.client.ico);
      let clientId: string;

      if (ico) {
        const { data: existing } = await supabase
          .from("clients")
          .select("id")
          .eq("ico", ico)
          .maybeSingle();
        if (existing) {
          clientId = existing.id;
        } else {
          const { data: newClient, error } = await supabase
            .from("clients")
            .insert({
              name: inv.client.name,
              ico,
              dic: inv.client.dic || null,
              address_street: inv.client.address_street || null,
              address_city: inv.client.address_city || null,
              address_zip: inv.client.address_zip || null,
              created_by: user.id,
            })
            .select("id")
            .single();
          if (error || !newClient) throw error ?? new Error("Klient insert failed");
          clientId = newClient.id;
        }
      } else {
        // Bez IČO — match podle názvu
        const { data: existing } = await supabase
          .from("clients")
          .select("id")
          .eq("name", inv.client.name)
          .maybeSingle();
        if (existing) {
          clientId = existing.id;
        } else {
          const { data: newClient, error } = await supabase
            .from("clients")
            .insert({
              name: inv.client.name,
              dic: inv.client.dic || null,
              address_street: inv.client.address_street || null,
              address_city: inv.client.address_city || null,
              address_zip: inv.client.address_zip || null,
              created_by: user.id,
            })
            .select("id")
            .single();
          if (error || !newClient) throw error ?? new Error("Klient insert failed");
          clientId = newClient.id;
        }
      }

      // 2) Vytvoř invoice_request se statusem archived
      const { data: invoice, error: invErr } = await supabase
        .from("invoice_requests")
        .insert({
          client_id: clientId,
          status: "archived",
          issued_at: inv.issued_at,
          invoice_issued_at: inv.issued_at,
          due_date: inv.due_date ?? null,
          variable_symbol: inv.variable_symbol ?? null,
          external_invoice_number: inv.external_invoice_number ?? null,
          payment_method: inv.payment_method,
          source: "manual",
          source_metadata: {
            imported: true,
            import_date: new Date().toISOString(),
          },
          created_by: user.id,
        })
        .select("id")
        .single();
      if (invErr || !invoice)
        throw invErr ?? new Error("Invoice insert failed");

      // 3) Položky
      const itemsRows = inv.items.map((it, i) => ({
        invoice_request_id: invoice.id,
        description: it.description,
        quantity: it.quantity,
        unit_price_no_vat: it.unit_price_no_vat,
        vat_rate: it.vat_rate,
        order_index: i,
      }));
      const { error: itemsErr } = await supabase
        .from("invoice_items")
        .insert(itemsRows);
      if (itemsErr) {
        // rollback faktury, aby nezůstávaly prázdné záznamy
        await supabase.from("invoice_requests").delete().eq("id", invoice.id);
        throw itemsErr;
      }

      results.created += 1;
      results.createdIds.push(invoice.id);
    } catch (err) {
      results.failed += 1;
      const label = `${inv.client.name} (${inv.external_invoice_number || "bez čísla"})`;
      results.errors.push({
        index: idx,
        message: `${label}: ${err instanceof Error ? err.message : "Neznámá chyba"}`,
      });
    }
  }

  return NextResponse.json(results);
}
