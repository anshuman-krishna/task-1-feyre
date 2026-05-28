import { ok } from "@/lib/api-response";
import { withErrorHandling } from "@/server/handler";
import { Unauthorized } from "@/lib/api-error";
import { markRead } from "@/services/notification";
import { getCurrentUser } from "@/server/session";

export const POST = withErrorHandling(async () => {
  const user = await getCurrentUser();
  if (!user) throw Unauthorized();
  const result = await markRead(user.id);
  return ok(result);
});
