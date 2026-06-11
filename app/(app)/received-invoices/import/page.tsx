import { createClient } from "@/lib/supabase/server";
import { ImportReceivedClient, type SupplierLite } from "./import-received-client";

export const metadata = {
  title: "Import přijatých faktur",
};

export default async function ImportReceivedPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("suppliers")
    .select("id, name, ico, default_payment_method, default_category")
    .order("name", { ascending: true });

  const suppliers: SupplierLite[] = (data ?? []).map((s) => ({
    id: s.id,
    name: s.name,
    ico: s.ico ?? null,
    default_payment_method: s.default_payment_method ?? null,
    default_category: s.default_category ?? null,
  }));

  return <ImportReceivedClient suppliers={suppliers} />;
}
