import type { NotificationPriority, NotificationType, Prisma } from "@prisma/client";
import { prisma } from "@/server/prisma";
import { events } from "@/server/events";
import { metrics } from "@/server/metrics";

type CreateInput = {
  userId: string;
  organizationId: string;
  type: NotificationType;
  title: string;
  body?: string;
  link?: string | null;
  payload?: Prisma.InputJsonValue;
  priority?: NotificationPriority;
  // when set, a fresh insert under the same (user, groupKey) is suppressed
  // until dedupeUntil passes. instead, we bump the existing row's createdAt
  // so it stays visible at the top of the bell.
  groupKey?: string;
  dedupeMinutes?: number;
};

// notification fan-out with built-in dedup. used by the queue worker,
// automation engine, and any future intelligence layer that wants to
// surface a signal without spamming the bell.
export async function createNotification(input: CreateInput) {
  const priority = input.priority ?? "normal";

  if (input.groupKey) {
    const existing = await prisma.notification.findFirst({
      where: {
        userId: input.userId,
        groupKey: input.groupKey,
        dedupeUntil: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
    });
    if (existing) {
      // refresh visibility without spawning a duplicate
      const refreshed = await prisma.notification.update({
        where: { id: existing.id },
        data: {
          createdAt: new Date(),
          title: input.title,
          body: input.body,
          priority,
          payload: input.payload,
          readAt: null,
        },
      });
      metrics.inc("notifications_deduped", { type: input.type });
      events.emit("notification.created", { userId: input.userId, notificationId: refreshed.id });
      return refreshed;
    }
  }

  const dedupeUntil =
    input.groupKey && input.dedupeMinutes
      ? new Date(Date.now() + input.dedupeMinutes * 60 * 1000)
      : null;

  const n = await prisma.notification.create({
    data: {
      userId: input.userId,
      organizationId: input.organizationId,
      type: input.type,
      priority,
      title: input.title,
      body: input.body,
      link: input.link ?? null,
      payload: input.payload,
      groupKey: input.groupKey,
      dedupeUntil,
    },
  });
  metrics.inc("notifications_created", { type: input.type, priority });
  events.emit("notification.created", { userId: input.userId, notificationId: n.id });
  return n;
}

export async function listNotifications(userId: string, limit = 20) {
  return prisma.notification.findMany({
    where: { userId, dismissedAt: null },
    orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
    take: limit,
  });
}

export async function unreadCount(userId: string) {
  return prisma.notification.count({ where: { userId, readAt: null, dismissedAt: null } });
}

export async function markRead(userId: string, ids?: string[]) {
  if (ids && ids.length === 0) return { count: 0 };
  return prisma.notification.updateMany({
    where: { userId, readAt: null, ...(ids ? { id: { in: ids } } : {}) },
    data: { readAt: new Date() },
  });
}

export async function dismiss(userId: string, id: string) {
  return prisma.notification.updateMany({
    where: { id, userId },
    data: { dismissedAt: new Date() },
  });
}

// summary of unread counts by priority — used to badge the bell smarter
export async function unreadSummary(userId: string) {
  const rows = await prisma.notification.groupBy({
    by: ["priority"],
    where: { userId, readAt: null, dismissedAt: null },
    _count: { _all: true },
  });
  const out: Record<NotificationPriority, number> = { low: 0, normal: 0, high: 0, critical: 0 };
  for (const r of rows) out[r.priority] = r._count._all;
  return out;
}
