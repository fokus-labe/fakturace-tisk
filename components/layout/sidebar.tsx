"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  FileText,
  Home,
  Settings,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/", label: "Přehled", icon: Home },
  { href: "/invoices", label: "Faktury", icon: FileText },
  { href: "/clients", label: "Klienti", icon: Users },
  { href: "/settings", label: "Nastavení", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex md:w-60 md:flex-col md:border-r md:bg-sidebar md:text-sidebar-foreground">
      <div className="px-5 py-5 border-b">
        <div className="h-1.5 w-10 rounded-full bg-[#C6E94D] mb-2" />
        <div className="text-sm font-semibold leading-tight">Fokus tisk</div>
        <div className="text-xs text-muted-foreground">Fakturace</div>
      </div>
      <nav className="flex-1 px-2 py-4 space-y-0.5">
        {nav.map((item) => {
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                  : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              )}
            >
              <Icon className="size-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
