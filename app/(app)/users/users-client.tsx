"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { UserRow, VenueLite } from "@/lib/users/types";
import { CreateUserDialog } from "@/components/users/create-user-dialog";
import { EditUserDialog } from "@/components/users/edit-user-dialog";
import { ResetPasswordDialog } from "@/components/users/reset-password-dialog";
import { DeleteUserDialog } from "@/components/users/delete-user-dialog";

function formatLogin(iso: string | null): string {
  if (!iso) return "nikdy";
  return new Date(iso).toLocaleString("cs-CZ", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function venuesLabel(user: UserRow, totalVenues: number): string {
  if (user.isAdmin) return `Všechny (${totalVenues})`;
  if (user.access.length === 0) return "—";
  return user.access.map((a) => a.name).join(", ");
}

const ROLE_LABELS: Record<string, string> = {
  manager: "Manažer",
  viewer: "Pouze čtení",
  admin: "Admin",
};

function roleLabel(user: UserRow): string {
  if (user.isAdmin) return "Admin";
  if (user.access.length === 0) return "—";
  const roles = user.access.map((a) => a.role);
  const unique = [...new Set(roles)];
  if (unique.length === 1) {
    const base = ROLE_LABELS[unique[0]] ?? unique[0];
    return roles.length > 1 ? `${base} ×${roles.length}` : base;
  }
  return "Smíšené";
}

export function UsersClient({
  initialUsers,
  venues,
  currentUserId,
}: {
  initialUsers: UserRow[];
  venues: VenueLite[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editUser, setEditUser] = useState<UserRow | null>(null);
  const [resetUser, setResetUser] = useState<UserRow | null>(null);
  const [deleteUser, setDeleteUser] = useState<UserRow | null>(null);

  const refresh = () => router.refresh();

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return initialUsers;
    return initialUsers.filter((u) =>
      (u.email ?? "").toLowerCase().includes(q),
    );
  }, [initialUsers, search]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Hledat podle emailu…"
          className="sm:max-w-xs"
        />
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="size-4 mr-2" />
          Nový uživatel
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Provozovny</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Poslední login</TableHead>
                  <TableHead className="text-right">Akce</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="px-4 py-6 text-center text-muted-foreground"
                    >
                      {initialUsers.length === 0
                        ? "Žádní uživatelé."
                        : "Nic nenalezeno."}
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell className="font-mono text-xs">
                        {u.email ?? "—"}
                        {u.id === currentUserId ? (
                          <span className="ml-2 text-[10px] uppercase text-muted-foreground">
                            (vy)
                          </span>
                        ) : null}
                      </TableCell>
                      <TableCell className="max-w-[220px] truncate text-sm text-muted-foreground">
                        {venuesLabel(u, venues.length)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={u.isAdmin ? "default" : "secondary"}>
                          {roleLabel(u)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground tabular-nums">
                        {formatLogin(u.last_sign_in_at)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            onClick={() => setEditUser(u)}
                            aria-label="Upravit"
                          >
                            <Pencil className="size-4" />
                          </Button>
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            onClick={() => setResetUser(u)}
                            aria-label="Reset hesla"
                          >
                            <KeyRound className="size-4" />
                          </Button>
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            onClick={() => setDeleteUser(u)}
                            disabled={u.id === currentUserId}
                            aria-label="Smazat"
                            title={
                              u.id === currentUserId
                                ? "Nelze smazat sám sebe"
                                : "Smazat"
                            }
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <CreateUserDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        venues={venues}
        onSuccess={refresh}
      />
      <EditUserDialog
        user={editUser}
        open={editUser !== null}
        onOpenChange={(open) => !open && setEditUser(null)}
        venues={venues}
        onSuccess={refresh}
      />
      <ResetPasswordDialog
        user={resetUser}
        open={resetUser !== null}
        onOpenChange={(open) => !open && setResetUser(null)}
      />
      <DeleteUserDialog
        user={deleteUser}
        open={deleteUser !== null}
        onOpenChange={(open) => !open && setDeleteUser(null)}
        onSuccess={refresh}
      />
    </div>
  );
}
