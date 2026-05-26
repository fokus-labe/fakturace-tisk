import Link from "next/link";
import { Plus } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils/format";
import { RECEIVED_INVOICE_CATEGORY_LABELS } from "@/types/received-invoice";
import type { ReceivedInvoiceCategory } from "@/types/received-invoice";

export default async function SuppliersPage() {
  const supabase = await createClient();
  const { data: suppliers } = await supabase
    .from("suppliers")
    .select("id, name, ico, email, default_category, created_at")
    .order("name", { ascending: true })
    .limit(500);

  const list = suppliers ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dodavatelé</h1>
          <p className="text-sm text-muted-foreground">
            Evidence dodavatelů Fokus tisk.
          </p>
        </div>
        <Link href="/suppliers/new" className={cn(buttonVariants())}>
          <Plus className="size-4 mr-2" />
          Nový dodavatel
        </Link>
      </div>

      <Card>
        <CardContent className="p-0">
          {list.length === 0 ? (
            <p className="text-sm text-muted-foreground p-6">
              Zatím tu nejsou žádní dodavatelé.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Jméno</TableHead>
                  <TableHead>IČO</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Kategorie default</TableHead>
                  <TableHead>Přidán</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>
                      <Link
                        href={`/suppliers/${s.id}`}
                        className="hover:underline"
                      >
                        {s.name}
                      </Link>
                    </TableCell>
                    <TableCell>{s.ico ?? "—"}</TableCell>
                    <TableCell>{s.email ?? "—"}</TableCell>
                    <TableCell>
                      {s.default_category
                        ? RECEIVED_INVOICE_CATEGORY_LABELS[
                            s.default_category as ReceivedInvoiceCategory
                          ]
                        : "—"}
                    </TableCell>
                    <TableCell>{formatDate(s.created_at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
