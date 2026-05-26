"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  FileInput,
  FileSpreadsheet,
  FileText,
  LayoutDashboard,
  Settings,
  Users,
  type LucideIcon,
} from "lucide-react";

import { Logo } from "@/components/logo";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

interface NavGroup {
  label?: string;
  items: NavItem[];
}

const navigationGroups: NavGroup[] = [
  { items: [{ href: "/", label: "Přehled", icon: LayoutDashboard }] },
  {
    label: "Příjmy",
    items: [
      { href: "/invoices", label: "Vydané faktury", icon: FileText },
      { href: "/clients", label: "Klienti", icon: Users },
    ],
  },
  {
    label: "Výdaje",
    items: [
      {
        href: "/received-invoices",
        label: "Přijaté faktury",
        icon: FileInput,
      },
      { href: "/suppliers", label: "Dodavatelé", icon: Building2 },
    ],
  },
  {
    items: [
      { href: "/etn-export", label: "ETN Export", icon: FileSpreadsheet },
      { href: "/settings", label: "Nastavení", icon: Settings },
    ],
  },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex md:w-60 md:flex-col md:border-r md:bg-background">
      <div className="px-6 pt-6 pb-4">
        <Link href="/" className="block">
          <Logo width={120} height={50} priority />
        </Link>
        <p className="mt-2 text-xs uppercase tracking-widest text-muted-foreground">
          Fakturace
        </p>
      </div>

      <div className="mx-3 border-b" />

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {navigationGroups.map((group, gi) => (
          <div key={gi} className={gi > 0 ? "mt-6" : ""}>
            {group.label ? (
              <p className="px-3 mb-2 text-xs uppercase tracking-widest text-muted-foreground font-medium">
                {group.label}
              </p>
            ) : null}
            <ul className="space-y-1">
              {group.items.map((item) => {
                const active = isActive(pathname, item.href);
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={cn(
                        "relative flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                        active
                          ? "bg-muted text-foreground font-medium"
                          : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                      )}
                    >
                      {active ? (
                        <span
                          aria-hidden="true"
                          className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-0.5 rounded-r bg-primary"
                        />
                      ) : null}
                      <Icon className="size-4 shrink-0" />
                      <span>{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  );
}
