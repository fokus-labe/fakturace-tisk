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
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Klienti</h1>
          <p className="text-sm text-muted-foreground">
            Evidence odběratelů Fokus tisk.
          </p>
        </div>
        <Link
          href="/clients/new"
          className={cn(buttonVariants(), "w-full sm:w-auto")}
        >
          <Plus className="size-4 mr-2" />
          Nový klient
        </Link>
      </div>

      {list.length === 0 ? (
        <Card>
          <CardContent>
            <p className="text-sm text-muted-foreground p-6 text-center">
              Zatím tu nejsou žádní klienti.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Mobile: card list */}
          <div className="md:hidden space-y-2">
            {list.map((c) => (
              <Link
                key={c.id}
                href={`/clients/${c.id}`}
                className="block rounded-lg border bg-card p-4 transition-colors active:bg-muted/30"
              >
                <p className="font-medium truncate">{c.name}</p>
                <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                  <span className="font-mono">{c.ico ?? "—"}</span>
                  <span className="truncate ml-2">{c.email ?? "—"}</span>
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
                      <TableCell className="font-mono text-xs">
                        {c.ico ?? "—"}
                      </TableCell>
                      <TableCell>{c.email ?? "—"}</TableCell>
                      <TableCell className="tabular-nums">
                        {formatDate(c.created_at)}
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
