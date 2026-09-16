import { createClient } from "@/lib/supabase/server";
import { getActiveVenue } from "@/lib/venues/get-user-venues";
import { VenueBreadcrumb } from "@/components/venue/venue-breadcrumb";
import {
  ImportReceivedClient,
  type ClientLite,
  type SupplierLite,
} from "./import-received-client";

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

  let clientsQuery = supabase
    .from("clients")
    .select("id, name")
    .order("name", { ascending: true });
  if (venue) clientsQuery = clientsQuery.eq("venue_id", venue.id);

  const [{ data: supplierData }, { data: clientData }] = await Promise.all([
    suppliersQuery,
    clientsQuery,
  ]);

  const suppliers: SupplierLite[] = (supplierData ?? []).map((s) => ({
    id: s.id,
    name: s.name,
    ico: s.ico ?? null,
    default_payment_method: s.default_payment_method ?? null,
    default_category: s.default_category ?? null,
  }));

  const clients: ClientLite[] = (clientData ?? []).map((c) => ({
    id: c.id,
    name: c.name,
  }));

  return (
    <div className="space-y-2">
      <VenueBreadcrumb />
      <ImportReceivedClient suppliers={suppliers} clients={clients} />
    </div>
  );
}
