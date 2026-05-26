import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SupplierForm } from "@/components/supplier/supplier-form";
import { DeleteButton } from "@/components/ui/delete-button";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function SupplierDetailPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: supplier } = await supabase
    .from("suppliers")
    .select("*")
    .eq("id", id)
    .single();
  if (!supplier) notFound();

  return (
    <div className="space-y-6">
      <Link
        href="/suppliers"
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4 mr-1" />
        Dodavatelé
      </Link>
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <h1 className="text-2xl font-semibold tracking-tight">
          {supplier.name}
        </h1>
        <DeleteButton
          endpoint={`/api/suppliers/${id}`}
          redirectTo="/suppliers"
          description="Dodavatel bude trvale odstraněn ze systému. Pokud má přijaté faktury, smazání selže — nejprve smaž faktury."
          successMessage="Dodavatel smazán"
        />
      </div>
      <SupplierForm mode="edit" initial={supplier} />
    </div>
  );
}
