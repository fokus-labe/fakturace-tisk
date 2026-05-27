import {
  Building2,
  FileInput,
  FileSpreadsheet,
  FileText,
  LayoutDashboard,
  Settings,
  Upload,
  Users,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export interface NavGroup {
  label?: string;
  items: NavItem[];
}

export const NAVIGATION_GROUPS: NavGroup[] = [
  { items: [{ href: "/", label: "Přehled", icon: LayoutDashboard }] },
  {
    label: "Příjmy",
    items: [
      { href: "/invoices", label: "Vydané faktury", icon: FileText },
      { href: "/clients", label: "Klienti", icon: Users },
      { href: "/import", label: "Import faktur", icon: Upload },
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

export function isNavActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}
