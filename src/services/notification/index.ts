import type { NotificationType, Prisma } from "@prisma/client";
import { prisma } from "@/server/prisma";
import { events } from "@/server/events";
import { metrics } from "@/server/metrics";

type CreateInput = {
  userId: string;
  organizationId: string;
  type: NotificationType;
  title: string;
  body?: string;
  link?: string;
  payload?: Prisma.InputJsonValue;
};

export async function createNotification(input: CreateInput) {
  const n = await prisma.notification.create({
    data: {
      userId: input.userId,
      organizationId: input.organizationId,
      type: input.type,
      title: input.title,
      body: input.body,
      link: input.link,
      payload: input.payload,
    },
  });
  metrics.inc("notifications_created", { type: input.type });
  events.emit("notification.created", { userId: input.userId, notificationId: n.id });
  return n;
}

export async function listNotifications(userId: string, limit = 20) {
  return prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

export async function unreadCount(userId: string) {
  return prisma.notification.count({ where: { userId, readAt: null } });
}

export async function markRead(userId: string, ids?: string[]) {
  if (ids && ids.length === 0) return { count: 0 };
  return prisma.notification.updateMany({
    where: { userId, readAt: null, ...(ids ? { id: { in: ids } } : {}) },
    data: { readAt: new Date() },
  });
}
