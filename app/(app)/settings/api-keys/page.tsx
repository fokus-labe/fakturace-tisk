import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/venues/is-admin";
import { formatDate } from "@/lib/utils/format";
import { ApiKeysClient } from "./api-keys-client";

export const metadata = { title: "API klíče · Fokus tisk" };

export default async function ApiKeysPage() {
  if (!(await isAdmin())) redirect("/settings");

  const supabase = await createClient();
  const { data } = await supabase
    .from("api_keys")
    .select(
      "id, name, key_prefix, scopes, created_at, last_used_at, revoked_at",
    )
    .order("created_at", { ascending: false });

  const keys = data ?? [];

  return (
    <div className="space-y-6">
      <Link
        href="/settings"
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4 mr-1" />
        Nastavení
      </Link>
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">API klíče</h1>
          <p className="text-sm text-muted-foreground">
            Klíče pro vytváření faktur z externích systémů (e-shopy).
          </p>
        </div>
        <ApiKeysClient />
      </div>

      <Card>
        <CardContent className="p-0">
          {keys.length === 0 ? (
            <p className="text-sm text-muted-foreground p-6">
              Zatím tu nejsou žádné klíče.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Jméno</TableHead>
                  <TableHead>Prefix</TableHead>
                  <TableHead>Naposledy použit</TableHead>
                  <TableHead>Vytvořen</TableHead>
                  <TableHead>Stav</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {keys.map((k) => (
                  <TableRow key={k.id}>
                    <TableCell className="font-medium">{k.name}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {k.key_prefix}…
                    </TableCell>
                    <TableCell>
                      {k.last_used_at ? formatDate(k.last_used_at) : "—"}
                    </TableCell>
                    <TableCell>{formatDate(k.created_at)}</TableCell>
                    <TableCell>
                      {k.revoked_at ? (
                        <Badge variant="destructive">Zneplatněn</Badge>
                      ) : (
                        <Badge>Aktivní</Badge>
                      )}
                    </TableCell>
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
