import { createClient } from "@/lib/supabase/server";
import { getActiveVenue } from "@/lib/venues/get-user-venues";
import { VenueBreadcrumb } from "@/components/venue/venue-breadcrumb";
import { ImportReceivedClient, type SupplierLite } from "./import-received-client";

export const metadata = {
  title: "Import přijatých faktur",
};

export default async function ImportReceivedPage() {
  const supabase = await createClient();
  const venue = await getActiveVenue();
  let suppliersQuery = supabase
    .from("suppliers")
    .select("id, name, ico, default_payment_method, default_category")
    .order("name", { ascending: true });
  if (venue) suppliersQuery = suppliersQuery.eq("venue_id", venue.id);
  const { data } = await suppliersQuery;

  const suppliers: SupplierLite[] = (data ?? []).map((s) => ({
    id: s.id,
    name: s.name,
    ico: s.ico ?? null,
    default_payment_method: s.default_payment_method ?? null,
    default_category: s.default_category ?? null,
  }));

  return (
    <div className="space-y-2">
      <VenueBreadcrumb />
      <ImportReceivedClient suppliers={suppliers} />
    </div>
  );
}
