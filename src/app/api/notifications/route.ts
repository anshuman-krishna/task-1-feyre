import { ok } from "@/lib/api-response";
import { withErrorHandling } from "@/server/handler";
import { Unauthorized } from "@/lib/api-error";
import { listNotifications, unreadCount } from "@/services/notification";
import { getCurrentUser } from "@/server/session";

export const GET = withErrorHandling(async () => {
  const user = await getCurrentUser();
  if (!user) throw Unauthorized();
  const [items, unread] = await Promise.all([
    listNotifications(user.id, 20),
    unreadCount(user.id),
  ]);
  return ok({ items, unread });
});
