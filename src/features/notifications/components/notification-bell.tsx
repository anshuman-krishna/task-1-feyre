"use client";

import Link from "next/link";
import {
  Bell,
  CheckCheck,
  Sparkles,
  AlertTriangle,
  CalendarClock,
  ShieldAlert,
  Wand2,
  TrendingUp,
  UserCog,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/cn";
import { relativeTime } from "@/lib/format";
import {
  useDismissNotification,
  useMarkAllRead,
  useMarkRead,
  useNotifications,
  type Notification,
} from "../queries";

const icon: Record<Notification["type"], React.ElementType> = {
  prediction_completed: Sparkles,
  prediction_failed: AlertTriangle,
  follow_up_due: CalendarClock,
  patient_critical: ShieldAlert,
  system: Bell,
  automation: Wand2,
  anomaly_detected: TrendingUp,
  assignment_changed: UserCog,
};

const priorityRail: Record<Notification["priority"], string> = {
  critical: "border-l-red-500",
  high: "border-l-orange-400",
  normal: "border-l-transparent",
  low: "border-l-transparent",
};

const typeTint: Record<Notification["type"], string> = {
  prediction_completed: "bg-accent text-accent-foreground",
  prediction_failed: "bg-red-50 text-red-700",
  follow_up_due: "bg-amber-50 text-amber-800",
  patient_critical: "bg-red-50 text-red-700",
  system: "bg-muted text-muted-foreground",
  automation: "bg-indigo-50 text-indigo-700",
  anomaly_detected: "bg-orange-50 text-orange-800",
  assignment_changed: "bg-muted text-muted-foreground",
};

export function NotificationBell() {
  const { data } = useNotifications();
  const markRead = useMarkRead();
  const markAll = useMarkAllRead();
  const dismiss = useDismissNotification();

  const items = data?.items ?? [];
  const unread = data?.unread ?? 0;
  const criticalUnread = items.filter(
    (n) => n.readAt == null && n.priority === "critical",
  ).length;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Notifications" className="relative">
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <span
              className={cn(
                "absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-semibold text-white",
                criticalUnread > 0 ? "bg-red-500" : "bg-primary",
              )}
            >
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-96 p-0">
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <div className="space-y-0.5">
            <p className="text-sm font-medium text-foreground">Notifications</p>
            {criticalUnread > 0 && (
              <p className="text-[10px] text-red-600">
                {criticalUnread} critical waiting on you
              </p>
            )}
          </div>
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
                return (
                  <li
                    key={n.id}
                    className={cn(
                      "group relative border-l-4 transition-colors hover:bg-muted/60",
                      priorityRail[n.priority],
                      isUnread && "bg-accent/30",
                    )}
                  >
                    <div className="flex items-start gap-3 px-3 py-2.5">
                      <div
                        className={cn(
                          "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md",
                          typeTint[n.type],
                        )}
                      >
                        <Icon className="h-3.5 w-3.5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p
                          className={cn(
                            "flex items-center gap-1.5 text-sm",
                            isUnread ? "font-medium text-foreground" : "text-muted-foreground",
                          )}
                        >
                          {n.title}
                          {n.priority === "critical" && (
                            <span className="rounded-full bg-red-50 px-1.5 py-0.5 text-[9px] font-semibold text-red-600">
                              CRITICAL
                            </span>
                          )}
                          {n.priority === "high" && (
                            <span className="rounded-full bg-orange-50 px-1.5 py-0.5 text-[9px] font-semibold text-orange-700">
                              HIGH
                            </span>
                          )}
                        </p>
                        {n.body && (
                          <p className="line-clamp-2 text-xs text-muted-foreground">{n.body}</p>
                        )}
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          {relativeTime(n.createdAt)}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        {isUnread && <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary" />}
                        <button
                          aria-label="Dismiss"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            dismiss.mutate(n.id);
                          }}
                          className="opacity-0 transition-opacity group-hover:opacity-100"
                        >
                          <X className="h-3 w-3 text-muted-foreground" />
                        </button>
                      </div>
                    </div>
                    {n.link && (
                      <Link
                        href={n.link}
                        className="absolute inset-0"
                        onClick={() => isUnread && markRead.mutate(n.id)}
                        aria-label={n.title}
                      />
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
