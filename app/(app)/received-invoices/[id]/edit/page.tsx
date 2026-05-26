import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ReceivedInvoiceForm } from "@/components/received-invoice/received-invoice-form";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditReceivedInvoicePage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: invoice }, { data: suppliers }] = await Promise.all([
    supabase
      .from("received_invoices")
      .select("*")
      .eq("id", id)
      .single(),
    supabase
      .from("suppliers")
      .select("id, name, default_payment_method, default_category")
      .order("name", { ascending: true })
      .limit(500),
  ]);
  if (!invoice) notFound();

  return (
    <div className="space-y-6">
      <Link
        href={`/received-invoices/${id}`}
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4 mr-1" />
        Zpět na detail
      </Link>
      <h1 className="text-2xl font-semibold tracking-tight">
        Upravit přijatou fakturu
      </h1>
      <ReceivedInvoiceForm
        suppliers={suppliers ?? []}
        initial={{
          ...invoice,
          amount_no_vat: Number(invoice.amount_no_vat),
          amount_vat: Number(invoice.amount_vat),
          amount_total: Number(invoice.amount_total),
        }}
        mode="edit"
      />
    </div>
  );
}
