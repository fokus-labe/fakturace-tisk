import { SupplierForm } from "@/components/supplier/supplier-form";

export const metadata = { title: "Nový dodavatel · Fokus tisk" };

export default function NewSupplierPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Nový dodavatel</h1>
      </div>
      <SupplierForm mode="create" />
    </div>
  );
}
