import { ClientForm } from "@/components/client/client-form";

export const metadata = { title: "Nový klient · Fokus tisk" };

export default function NewClientPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Nový klient</h1>
      </div>
      <ClientForm mode="create" />
    </div>
  );
}
