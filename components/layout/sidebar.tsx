"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Logo } from "@/components/logo";
import { cn } from "@/lib/utils";
import {
  NAVIGATION_GROUPS,
  isNavActive,
  type NavItem,
} from "./nav-config";

function NavLink({
  item,
  pathname,
  onNavigate,
}: {
  item: NavItem;
  pathname: string;
  onNavigate?: () => void;
}) {
  const active = isNavActive(pathname, item.href);
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={cn(
        "relative flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors",
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
  );
}

interface SidebarNavProps {
  onNavigate?: () => void;
}

export function SidebarNav({ onNavigate }: SidebarNavProps) {
  const pathname = usePathname();
  return (
    <nav className="flex-1 overflow-y-auto px-3 py-4">
      {NAVIGATION_GROUPS.map((group, gi) => (
        <div key={gi} className={gi > 0 ? "mt-6" : ""}>
          {group.label ? (
            <p className="px-3 mb-2 text-xs uppercase tracking-widest text-muted-foreground font-medium">
              {group.label}
            </p>
          ) : null}
          <ul className="space-y-1">
            {group.items.map((item) => (
              <li key={item.href}>
                <NavLink
                  item={item}
                  pathname={pathname}
                  onNavigate={onNavigate}
                />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}

export function SidebarBrand() {
  return (
    <div className="px-6 pt-6 pb-4">
      <Link href="/" className="block">
        <Logo width={120} height={50} priority />
      </Link>
      <p className="mt-2 text-xs uppercase tracking-widest text-muted-foreground">
        Fakturace
      </p>
    </div>
  );
}

export function Sidebar() {
  return (
    <aside className="hidden md:flex md:w-60 md:flex-col md:border-r md:bg-background">
      <SidebarBrand />
      <div className="mx-3 border-b" />
      <SidebarNav />
    </aside>
  );
}
