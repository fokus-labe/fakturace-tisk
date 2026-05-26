"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  FileInput,
  FileSpreadsheet,
  FileText,
  Home,
  Settings,
  Users,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const topItems: NavItem[] = [
  { href: "/", label: "Přehled", icon: Home },
];

const groups: NavGroup[] = [
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
];

const bottomItems: NavItem[] = [
  { href: "/etn-export", label: "ETN Export", icon: FileSpreadsheet },
  { href: "/settings", label: "Nastavení", icon: Settings },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

function NavLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const active = isActive(pathname, item.href);
  const Icon = item.icon;
  return (
    <Link
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
}

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
        {topItems.map((item) => (
          <NavLink key={item.href} item={item} pathname={pathname} />
        ))}

        {groups.map((group) => (
          <div key={group.label}>
            <div className="text-xs uppercase tracking-widest text-muted-foreground px-3 mt-6 mb-2">
              {group.label}
            </div>
            <div className="space-y-0.5">
              {group.items.map((item) => (
                <NavLink key={item.href} item={item} pathname={pathname} />
              ))}
            </div>
          </div>
        ))}

        <div className="border-t mt-6 pt-4 space-y-0.5">
          {bottomItems.map((item) => (
            <NavLink key={item.href} item={item} pathname={pathname} />
          ))}
        </div>
      </nav>
    </aside>
  );
}
