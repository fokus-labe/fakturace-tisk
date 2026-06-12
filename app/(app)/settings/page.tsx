import Link from "next/link";
import { ExternalLink, Users as UsersIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ChangePasswordDialog } from "@/components/settings/change-password-dialog";
import {
  UserVenuesManager,
  type ManagerAssignment,
} from "@/components/settings/user-venues-manager";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/venues/is-admin";
import { ISSUER } from "@/config/issuer";

interface UserRow {
  id: string;
  email: string | undefined;
  created_at: string;
  last_sign_in_at: string | null;
}

function projectRefFromUrl(url: string | undefined): string | null {
  if (!url) return null;
  const match = url.match(/\/\/([^.]+)\.supabase\.co/);
  return match?.[1] ?? null;
}

function formatDateTimeCZ(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("cs-CZ", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Načti uživatele přímo přes service client (server-side)
  let users: UserRow[] = [];
  try {
    const admin = createServiceClient();
    const { data, error } = await admin.auth.admin.listUsers();
    if (!error && data) {
      users = (data.users ?? [])
        .map((u) => ({
          id: u.id,
          email: u.email,
          created_at: u.created_at,
          last_sign_in_at: u.last_sign_in_at ?? null,
        }))
        .sort((a, b) => {
          const aTime = a.last_sign_in_at
            ? new Date(a.last_sign_in_at).getTime()
            : 0;
          const bTime = b.last_sign_in_at
            ? new Date(b.last_sign_in_at).getTime()
            : 0;
          return bTime - aTime;
        });
    }
  } catch {
    // ignore — tabulka pak ukáže prázdný stav
  }

  const projectRef = projectRefFromUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const supabaseAuthUrl = projectRef
    ? `https://supabase.com/dashboard/project/${projectRef}/auth/users`
    : "https://supabase.com/dashboard";

  // Admin sekce: přiřazení uživatelů k provozovnám
  const admin = await isAdmin();
  let venues: { id: string; name: string }[] = [];
  let assignments: ManagerAssignment[] = [];
  if (admin) {
    const { data: venueRows } = await supabase
      .from("venues")
      .select("id, name")
      .order("name", { ascending: true });
    venues = venueRows ?? [];
    const { data: assignmentRows } = await supabase
      .from("user_venues")
      .select("user_id, venue_id, role");
    assignments = (assignmentRows ?? []) as ManagerAssignment[];
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Nastavení</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {admin ? "Správa účtu, uživatelů a systému." : "Správa účtu."}
        </p>
      </div>

      {/* Můj účet */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Můj účet</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <dl className="space-y-3 text-sm">
            <div className="flex gap-4">
              <dt className="text-muted-foreground w-44">Email</dt>
              <dd className="font-mono">{user?.email ?? "—"}</dd>
            </div>
            <div className="flex gap-4">
              <dt className="text-muted-foreground w-44">
                Naposledy přihlášen
              </dt>
              <dd className="tabular-nums">
                {formatDateTimeCZ(user?.last_sign_in_at ?? null)}
              </dd>
            </div>
          </dl>
          <ChangePasswordDialog />
        </CardContent>
      </Card>

      {/* Uživatelé systému — jen admin */}
      {admin ? (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <UsersIcon className="size-4" />
            Uživatelé systému
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            V systému jsou tito uživatelé. Přístup k jednotlivým provozovnám
            spravuje admin v sekci „Přístup k provozovnám“ níže.
          </p>

          {/* Mobile: card list */}
          <div className="md:hidden space-y-2">
            {users.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                Žádní uživatelé nenačteni.
              </p>
            ) : (
              users.map((u) => (
                <div
                  key={u.id}
                  className="rounded-lg border bg-card p-3"
                >
                  <p className="font-mono text-xs truncate">{u.email ?? "—"}</p>
                  <p className="mt-1 text-xs text-muted-foreground tabular-nums">
                    Naposledy přihlášen: {formatDateTimeCZ(u.last_sign_in_at)}
                  </p>
                </div>
              ))
            )}
          </div>

          {/* Desktop: table */}
          <div className="hidden md:block border rounded-md overflow-hidden">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Naposledy přihlášen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={2}
                      className="px-4 py-6 text-center text-muted-foreground"
                    >
                      Žádní uživatelé nenačteni.
                    </TableCell>
                  </TableRow>
                ) : (
                  users.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell className="font-mono text-xs">
                        {u.email ?? "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground tabular-nums">
                        {formatDateTimeCZ(u.last_sign_in_at)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div className="rounded-md border bg-muted/30 p-4">
            <h3 className="text-sm font-semibold mb-2">
              Jak přidat nového uživatele
            </h3>
            <ol className="text-sm space-y-1 text-muted-foreground list-decimal list-inside">
              <li>Otevři Supabase Dashboard (odkaz níže)</li>
              <li>
                <strong>Authentication</strong> → <strong>Users</strong> →{" "}
                <strong>Add user</strong>
              </li>
              <li>
                Vyplň email, vygeneruj heslo, zaškrtni{" "}
                <strong>Auto Confirm User</strong>
              </li>
              <li>Pošli kolegovi přihlašovací údaje a URL aplikace</li>
              <li>
                Kolega se přihlásí a doporučí si změnit heslo (sekce Můj účet)
              </li>
            </ol>
            <div className="mt-4">
              <a
                href={supabaseAuthUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
              >
                Otevřít Supabase Auth dashboard
                <ExternalLink className="size-3.5" />
              </a>
            </div>
          </div>
        </CardContent>
      </Card>
      ) : null}

      {/* Přístup k provozovnám (jen admin) */}
      {admin ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <UsersIcon className="size-4" />
              Přístup k provozovnám
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Zaškrtni provozovny, ke kterým má uživatel přístup, a nastav roli.
              Role <strong>admin</strong> vidí a spravuje všechny provozovny.
            </p>
            <UserVenuesManager
              users={users.map((u) => ({ id: u.id, email: u.email ?? null }))}
              venues={venues}
              initialAssignments={assignments}
            />
            <div className="rounded-md border bg-muted/30 p-4 text-sm">
              💡 Tohle je rychlý přehled přístupů. Kompletní správu uživatelů
              (vytvoření, reset hesla, smazání) najdeš v sekci{" "}
              <Link href="/users" className="font-medium underline">
                Správa → Uživatelé
              </Link>
              .
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* Vystavovatel */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Vystavovatel</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-1 text-muted-foreground">
          <div className="text-foreground font-medium">{ISSUER.name}</div>
          <div>
            {ISSUER.division.name} · {ISSUER.division.note}
          </div>
          <div>
            {ISSUER.address.street}, {ISSUER.address.zip} {ISSUER.address.city}
          </div>
          <div>IČO: <span className="font-mono">{ISSUER.ico}</span></div>
          <div>
            {ISSUER.contact.email} · {ISSUER.contact.phone}
          </div>
          <p className="text-xs pt-2">
            Údaje jsou nastavené v <code>config/issuer.ts</code>.
          </p>
        </CardContent>
      </Card>

      {/* API klíče — jen admin */}
      {admin ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">API klíče</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            <p className="text-muted-foreground mb-3">
              Klíče pro budoucí napojení e-shopů na endpoint{" "}
              <code>POST /api/invoice-requests</code>.
            </p>
            <Link
              href="/settings/api-keys"
              className="text-sm font-medium underline"
            >
              Spravovat API klíče →
            </Link>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
