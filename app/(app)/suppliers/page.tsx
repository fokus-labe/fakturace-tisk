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
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dodavatelé</h1>
          <p className="text-sm text-muted-foreground">
            Evidence dodavatelů Fokus tisk.
          </p>
        </div>
        <Link
          href="/suppliers/new"
          className={cn(buttonVariants(), "w-full sm:w-auto")}
        >
          <Plus className="size-4 mr-2" />
          Nový dodavatel
        </Link>
      </div>

      {list.length === 0 ? (
        <Card>
          <CardContent>
            <p className="text-sm text-muted-foreground p-6 text-center">
              Zatím tu nejsou žádní dodavatelé.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Mobile: card list */}
          <div className="md:hidden space-y-2">
            {list.map((s) => (
              <Link
                key={s.id}
                href={`/suppliers/${s.id}`}
                className="block rounded-lg border bg-card p-4 transition-colors active:bg-muted/30"
              >
                <p className="font-medium truncate">{s.name}</p>
                <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground gap-2">
                  <span className="font-mono">{s.ico ?? "—"}</span>
                  <span className="truncate">
                    {s.default_category
                      ? RECEIVED_INVOICE_CATEGORY_LABELS[
                          s.default_category as ReceivedInvoiceCategory
                        ]
                      : s.email ?? "—"}
                  </span>
                </div>
              </Link>
            ))}
          </div>

          {/* Desktop: table */}
          <Card className="hidden md:block">
            <CardContent className="p-0">
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
                      <TableCell className="font-mono text-xs">
                        {s.ico ?? "—"}
                      </TableCell>
                      <TableCell>{s.email ?? "—"}</TableCell>
                      <TableCell>
                        {s.default_category
                          ? RECEIVED_INVOICE_CATEGORY_LABELS[
                              s.default_category as ReceivedInvoiceCategory
                            ]
                          : "—"}
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {formatDate(s.created_at)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
