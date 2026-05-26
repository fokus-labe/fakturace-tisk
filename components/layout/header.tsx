"use client";

import { useRouter } from "next/navigation";
import { ChevronDown, LogOut } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { createClient } from "@/lib/supabase/client";

interface HeaderProps {
  email: string | null;
}

function initialsFromEmail(email: string | null): string {
  if (!email) return "—";
  const prefix = email.split("@")[0] ?? "";
  const cleaned = prefix.replace(/[._-]+/g, " ").trim();
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return prefix.slice(0, 2).toUpperCase() || "—";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export function Header({ email }: HeaderProps) {
  const router = useRouter();
  const initials = initialsFromEmail(email);

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="flex h-14 items-center justify-between border-b bg-background px-6">
      <div />
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button
              type="button"
              className="flex items-center gap-2 rounded-md px-1.5 py-1 text-sm transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            />
          }
        >
          <div className="flex size-7 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-medium">
            {initials}
          </div>
          <span className="text-muted-foreground hidden sm:inline">
            {email ?? ""}
          </span>
          <ChevronDown className="size-4 text-muted-foreground" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" sideOffset={6}>
          <DropdownMenuItem variant="destructive" onClick={signOut}>
            <LogOut className="size-4 mr-2" />
            Odhlásit
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
