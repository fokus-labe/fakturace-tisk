import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ReceivedInvoiceForm } from "@/components/received-invoice/received-invoice-form";

export const metadata = { title: "Nová přijatá faktura · Fokus tisk" };

export default async function NewReceivedInvoicePage() {
  const supabase = await createClient();
  const { data: suppliers } = await supabase
    .from("suppliers")
    .select("id, name, default_payment_method, default_category")
    .order("name", { ascending: true })
    .limit(500);

  return (
    <div className="space-y-6">
      <Link
        href="/received-invoices"
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4 mr-1" />
        Přijaté faktury
      </Link>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Nová přijatá faktura
        </h1>
        <p className="text-sm text-muted-foreground">
          Zaeviduj fakturu od dodavatele. PDF příloha je volitelná.
        </p>
      </div>
      <ReceivedInvoiceForm suppliers={suppliers ?? []} mode="create" />
    </div>
  );
}
