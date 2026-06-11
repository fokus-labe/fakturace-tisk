"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, LogOut, Menu, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Logo } from "@/components/logo";
import { SidebarNav } from "@/components/layout/sidebar";
import {
  VenueSelector,
  type VenueOption,
} from "@/components/venue/venue-selector";
import { createClient } from "@/lib/supabase/client";

interface HeaderProps {
  email: string | null;
  venues: VenueOption[];
  activeSlug: string;
  isAdmin: boolean;
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

export function Header({ email, venues, activeSlug, isAdmin }: HeaderProps) {
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const initials = initialsFromEmail(email);

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-background px-3 sm:px-6">
      {/* Mobile: hamburger menu (vlevo) */}
      <div className="md:hidden">
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger
            render={
              <Button
                variant="ghost"
                size="icon"
                aria-label="Otevřít menu"
              />
            }
          >
            <Menu className="size-5" />
          </SheetTrigger>
          <SheetContent side="left" className="w-72 p-0">
            <div className="flex h-full flex-col">
              <div className="px-6 pt-6 pb-4">
                <Logo width={120} height={50} priority />
                <p className="mt-2 text-xs uppercase tracking-widest text-muted-foreground">
                  Fakturace
                </p>
              </div>
              <div className="mx-3 border-b" />
              <div className="px-3 py-3">
                <VenueSelector venues={venues} activeSlug={activeSlug} />
              </div>
              <div className="mx-3 border-b" />
              <SidebarNav
                onNavigate={() => setMobileOpen(false)}
                isAdmin={isAdmin}
              />
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {/* Desktop: prázdné místo levé strany */}
      <div className="hidden md:block" />

      {/* User dropdown (vždy vpravo) */}
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button
              type="button"
              aria-label="Menu uživatele"
              className="flex items-center gap-2 rounded-md px-1.5 py-1 text-sm transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            />
          }
        >
          <div className="flex size-7 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-medium">
            {initials}
          </div>
          <span className="text-muted-foreground hidden sm:inline truncate max-w-[200px]">
            {email ?? ""}
          </span>
          <ChevronDown className="size-4 text-muted-foreground" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" sideOffset={6}>
          <DropdownMenuItem onClick={() => router.push("/settings")}>
            <Settings className="size-4 mr-2" />
            Nastavení
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={signOut}>
            <LogOut className="size-4 mr-2" />
            Odhlásit
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
