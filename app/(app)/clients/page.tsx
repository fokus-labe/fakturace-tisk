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

export default async function ClientsPage() {
  const supabase = await createClient();
  const { data: clients } = await supabase
    .from("clients")
    .select("id, name, ico, email, created_at")
    .order("name", { ascending: true })
    .limit(500);

  const list = clients ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Klienti</h1>
          <p className="text-sm text-muted-foreground">
            Evidence odběratelů Fokus tisk.
          </p>
        </div>
        <Link href="/clients/new" className={cn(buttonVariants())}>
          <Plus className="size-4 mr-2" />
          Nový klient
        </Link>
      </div>

      <Card>
        <CardContent className="p-0">
          {list.length === 0 ? (
            <p className="text-sm text-muted-foreground p-6">
              Zatím tu nejsou žádní klienti.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Jméno</TableHead>
                  <TableHead>IČO</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Přidán</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>
                      <Link
                        href={`/clients/${c.id}`}
                        className="hover:underline"
                      >
                        {c.name}
                      </Link>
                    </TableCell>
                    <TableCell>{c.ico ?? "—"}</TableCell>
                    <TableCell>{c.email ?? "—"}</TableCell>
                    <TableCell>{formatDate(c.created_at)}</TableCell>
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
