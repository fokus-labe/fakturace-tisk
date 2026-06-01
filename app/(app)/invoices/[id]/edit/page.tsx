import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { InvoiceForm } from "@/components/invoice/invoice-form";
import type { IssuedPaymentMethod } from "@/types/invoice";

export const metadata = { title: "Upravit fakturu · Fokus tisk" };

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditInvoicePage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: invoice }, { data: clients }] = await Promise.all([
    supabase
      .from("invoice_requests")
      .select("*, items:invoice_items(*)")
      .eq("id", id)
      .single(),
    supabase
      .from("clients")
      .select("id, name")
      .order("name", { ascending: true })
      .limit(500),
  ]);
  if (!invoice) notFound();

  // Editovat lze jen koncepty. Pro ostatní stavy → zpět na detail.
  if (invoice.status !== "draft") {
    redirect(`/invoices/${id}`);
  }

  const items = (invoice.items ?? [])
    .map(
      (it: {
        description: string;
        quantity: number | string;
        unit_price_no_vat: number | string;
        vat_rate: number | string;
        order_index: number;
      }) => ({
        description: it.description,
        quantity: Number(it.quantity),
        unit_price_no_vat: Number(it.unit_price_no_vat),
        vat_rate: Number(it.vat_rate),
        order_index: it.order_index,
      }),
    )
    .sort(
      (a: { order_index: number }, b: { order_index: number }) =>
        a.order_index - b.order_index,
    )
    .map(({ order_index: _omit, ...rest }: { order_index: number }) => rest);

  return (
    <div className="space-y-6">
      <Link
        href={`/invoices/${id}`}
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4 mr-1" />
        Zpět na detail
      </Link>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Upravit fakturu
        </h1>
        <p className="text-sm text-muted-foreground">
          Změny můžeš provést pouze v konceptu. Po označení faktury jako
          vystavené už nepůjde upravit.
        </p>
      </div>
      <InvoiceForm
        clients={clients ?? []}
        mode="edit"
        invoiceId={id}
        initial={{
          client_id: invoice.client_id ?? "",
          issued_at: invoice.issued_at ?? "",
          due_date: invoice.due_date ?? "",
          variable_symbol: invoice.variable_symbol ?? "",
          payment_method:
            (invoice.payment_method as IssuedPaymentMethod) ?? "fakturace",
          short_description: invoice.short_description ?? "",
          notes: invoice.notes ?? "",
          items,
        }}
      />
    </div>
  );
}
