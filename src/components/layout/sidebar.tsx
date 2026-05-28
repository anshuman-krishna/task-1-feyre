"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  BarChart3,
  Settings,
  Stethoscope,
  Users,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/cn";

type NavItem = { href: string; label: string; icon: LucideIcon };

const primary: NavItem[] = [
  { href: "/", label: "Dashboard", icon: Activity },
  { href: "/patients", label: "Patients", icon: Users },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
];

const secondary: NavItem[] = [{ href: "/settings", label: "Settings", icon: Settings }];

export function Sidebar({ className }: { className?: string }) {
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/");

  return (
    <aside
      className={cn(
        "flex h-full w-60 shrink-0 flex-col border-r border-border bg-surface/70 backdrop-blur",
        className,
      )}
    >
      <div className="flex h-14 items-center gap-2 border-b border-border px-5">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <Stethoscope className="h-4 w-4" />
        </div>
        <div className="leading-tight">
          <p className="text-sm font-semibold tracking-tight">mira</p>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
            health intelligence
          </p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Workspace
        </p>
        <ul className="space-y-0.5">
          {primary.map((item) => (
            <NavLink key={item.href} item={item} active={isActive(item.href)} />
          ))}
        </ul>

        <p className="mt-6 px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          System
        </p>
        <ul className="space-y-0.5">
          {secondary.map((item) => (
            <NavLink key={item.href} item={item} active={isActive(item.href)} />
          ))}
        </ul>
      </nav>

      <div className="border-t border-border p-3">
        <div className="rounded-md bg-muted/60 p-3">
          <p className="text-xs font-medium text-foreground">Phase 1 preview</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            AI prediction layer wires up in the next phase.
          </p>
        </div>
      </div>
    </aside>
  );
}

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <li>
      <Link
        href={item.href}
        className={cn(
          "group flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors",
          active
            ? "bg-accent text-accent-foreground"
            : "text-muted-foreground hover:bg-muted hover:text-foreground",
        )}
      >
        <Icon className={cn("h-4 w-4", active ? "text-accent-foreground" : "text-muted-foreground")} />
        <span className="truncate">{item.label}</span>
      </Link>
    </li>
  );
}
