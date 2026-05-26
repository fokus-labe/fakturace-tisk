import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ClientForm } from "@/components/client/client-form";
import { DeleteButton } from "@/components/ui/delete-button";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ClientDetailPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: client } = await supabase
    .from("clients")
    .select("*")
    .eq("id", id)
    .single();
  if (!client) notFound();

  return (
    <div className="space-y-6">
      <Link
        href="/clients"
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4 mr-1" />
        Klienti
      </Link>
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <h1 className="text-2xl font-semibold tracking-tight">{client.name}</h1>
        <DeleteButton
          endpoint={`/api/clients/${id}`}
          redirectTo="/clients"
          description="Klient bude trvale odstraněn ze systému. Pokud má vystavené faktury, smazání selže — nejprve smaž faktury."
          successMessage="Klient smazán"
        />
      </div>
      <ClientForm mode="edit" initial={client} />
    </div>
  );
}
