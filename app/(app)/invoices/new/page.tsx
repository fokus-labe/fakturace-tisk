import { createClient } from "@/lib/supabase/server";
import { InvoiceForm } from "@/components/invoice/invoice-form";

export const metadata = { title: "Nová faktura · Fokus tisk" };

export default async function NewInvoicePage() {
  const supabase = await createClient();
  const { data: clients } = await supabase
    .from("clients")
    .select("id, name")
    .order("name", { ascending: true })
    .limit(500);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Nová faktura</h1>
        <p className="text-sm text-muted-foreground">
          Vyplň podklad — po uložení můžeš odeslat Petrovi k vystavení.
        </p>
      </div>
      <InvoiceForm clients={clients ?? []} />
    </div>
  );
}
