"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Check, ChevronDown } from "lucide-react";
import { fetcher } from "@/lib/fetcher";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type Membership = { id: string; name: string; slug: string; role: string; home: boolean };

export function OrgSwitcher() {
  const router = useRouter();
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    fetcher<{ active: string; memberships: Membership[] }>("/api/orgs")
      .then((res) => {
        setMemberships(res.memberships);
        setActive(res.active);
      })
      .catch(() => null);
  }, []);

  const onSwitch = async (id: string) => {
    if (id === active) return;
    setPending(true);
    try {
      await fetcher("/api/orgs/switch", {
        method: "POST",
        body: JSON.stringify({ organizationId: id }),
      });
      setActive(id);
      router.refresh();
    } catch {
      // silent — toast would clutter the header
    } finally {
      setPending(false);
    }
  };

  if (memberships.length <= 1) return null;
  const current = memberships.find((m) => m.id === active) ?? memberships[0]!;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-2 py-1 text-xs font-medium text-foreground transition-colors hover:bg-muted"
          aria-label="Switch organization"
        >
          <Building2 className="h-3 w-3 text-muted-foreground" />
          <span className="max-w-[140px] truncate">{current.name}</span>
          <ChevronDown className="h-3 w-3 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-56">
        <DropdownMenuLabel className="px-2 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
          Organizations
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {memberships.map((m) => (
          <DropdownMenuItem
            key={m.id}
            onSelect={(e) => e.preventDefault()}
            onClick={() => onSwitch(m.id)}
            disabled={pending}
            className="flex items-center justify-between"
          >
            <div>
              <p className="text-sm">{m.name}</p>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                {m.role}
                {m.home ? " · home" : ""}
              </p>
            </div>
            {m.id === active && <Check className="h-3.5 w-3.5 text-primary" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
