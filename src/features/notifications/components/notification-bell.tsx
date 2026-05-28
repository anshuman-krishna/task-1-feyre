"use client";

import Link from "next/link";
import { Bell, CheckCheck, Sparkles, AlertTriangle, CalendarClock, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/cn";
import { relativeTime } from "@/lib/format";
import { useMarkAllRead, useMarkRead, useNotifications, type Notification } from "../queries";

const icon: Record<Notification["type"], React.ElementType> = {
  prediction_completed: Sparkles,
  prediction_failed: AlertTriangle,
  follow_up_due: CalendarClock,
  patient_critical: ShieldAlert,
  system: Bell,
};

const tint: Record<Notification["type"], string> = {
  prediction_completed: "bg-accent text-accent-foreground",
  prediction_failed: "bg-red-50 text-red-700",
  follow_up_due: "bg-amber-50 text-amber-800",
  patient_critical: "bg-red-50 text-red-700",
  system: "bg-muted text-muted-foreground",
};

export function NotificationBell() {
  const { data } = useNotifications();
  const markRead = useMarkRead();
  const markAll = useMarkAllRead();

  const items = data?.items ?? [];
  const unread = data?.unread ?? 0;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Notifications" className="relative">
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-semibold text-white">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <p className="text-sm font-medium text-foreground">Notifications</p>
          <button
            onClick={() => markAll.mutate()}
            disabled={markAll.isPending || unread === 0}
            className="inline-flex items-center gap-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
          >
            <CheckCheck className="h-3 w-3" /> Mark all read
          </button>
        </div>
        <div className="max-h-96 overflow-y-auto">
          {items.length === 0 ? (
            <p className="px-4 py-6 text-center text-xs text-muted-foreground">
              You&apos;re all caught up.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {items.map((n) => {
                const Icon = icon[n.type];
                const isUnread = n.readAt == null;
                const Content = (
                  <div className="flex items-start gap-3 px-3 py-2.5">
                    <div
                      className={cn(
                        "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md",
                        tint[n.type],
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p
                        className={cn(
                          "text-sm",
                          isUnread ? "font-medium text-foreground" : "text-muted-foreground",
                        )}
                      >
                        {n.title}
                      </p>
                      {n.body && (
                        <p className="truncate text-xs text-muted-foreground">{n.body}</p>
                      )}
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {relativeTime(n.createdAt)}
                      </p>
                    </div>
                    {isUnread && <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary" />}
                  </div>
                );

                return (
                  <li
                    key={n.id}
                    className={cn(
                      "transition-colors hover:bg-muted/60",
                      isUnread && "bg-accent/30",
                    )}
                    onClick={() => isUnread && markRead.mutate(n.id)}
                  >
                    {n.link ? (
                      <Link href={n.link} className="block">
                        {Content}
                      </Link>
                    ) : (
                      Content
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
