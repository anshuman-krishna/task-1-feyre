"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { LogOut, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar } from "@/components/avatar";
import { NotificationBell } from "@/features/notifications/components/notification-bell";
import { SearchBox } from "@/features/search/components/search-box";
import { OrgSwitcher } from "@/features/organization/components/org-switcher";

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  avatarHue: number;
};

export function Header({
  user,
  onMenuClick,
}: {
  user: CurrentUser | null;
  onMenuClick?: () => void;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  const signOut = async () => {
    setPending(true);
    try {
      await fetch("/api/auth/sign-out", { method: "POST" });
    } finally {
      router.replace("/sign-in");
      router.refresh();
    }
  };

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur md:px-6">
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden"
        onClick={onMenuClick}
        aria-label="Open menu"
      >
        <Menu className="h-4 w-4" />
      </Button>

      <SearchBox />

      <div className="ml-auto flex items-center gap-2">
        <OrgSwitcher />
        <NotificationBell />

        {user ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="flex items-center gap-2 rounded-full border border-border bg-surface px-2 py-1 transition-colors hover:bg-muted"
                aria-label="Account"
              >
                <Avatar name={user.name} hue={user.avatarHue} size={24} />
                <span className="hidden text-xs font-medium md:inline">{user.name}</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-56">
              <DropdownMenuLabel className="space-y-0.5 px-2 py-2">
                <p className="text-sm font-medium text-foreground">{user.name}</p>
                <p className="truncate text-[11px] text-muted-foreground">{user.email}</p>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  {user.role}
                </p>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={(e) => e.preventDefault()} onClick={signOut} disabled={pending}>
                <LogOut className="h-3.5 w-3.5" /> Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>
    </header>
  );
}
