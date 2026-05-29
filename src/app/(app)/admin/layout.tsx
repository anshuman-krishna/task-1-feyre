import { redirect } from "next/navigation";
import Link from "next/link";
import {
  Activity,
  BarChart2,
  Database,
  FileText,
  Flame,
  Layers,
  ScrollText,
  Server,
  ShieldCheck,
  Wand2,
} from "lucide-react";
import { getCurrentUser } from "@/server/session";

const NAV = [
  { href: "/admin", label: "Overview", icon: Activity },
  { href: "/admin/providers", label: "Providers", icon: Server },
  { href: "/admin/queue", label: "Queue", icon: Layers },
  { href: "/admin/automation", label: "Automation", icon: Wand2 },
  { href: "/admin/policies", label: "Policies", icon: ShieldCheck },
  { href: "/admin/approvals", label: "Approvals", icon: ScrollText },
  { href: "/admin/simulations", label: "Reliability", icon: Flame },
  { href: "/admin/backups", label: "Backups", icon: Database },
  { href: "/admin/warehouse", label: "Warehouse", icon: BarChart2 },
  { href: "/admin/reports", label: "Reports", icon: FileText },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  if (user.role !== "admin") redirect("/");

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Operations
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">Administration center</h1>
        <p className="text-sm text-muted-foreground">
          Operational visibility and governance controls for {user.organizationId}.
        </p>
      </header>

      <nav className="flex flex-wrap gap-1 border-b border-border pb-2">
        {NAV.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <Icon className="h-3 w-3" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div>{children}</div>
    </div>
  );
}
