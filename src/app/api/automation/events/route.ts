import { ok } from "@/lib/api-response";
import { Unauthorized } from "@/lib/api-error";
import { withErrorHandling } from "@/server/handler";
import { getCurrentUser } from "@/server/session";
import { recentAutomationEvents } from "@/services/automation";

export const GET = withErrorHandling(async () => {
  const user = await getCurrentUser();
  if (!user) throw Unauthorized();
  const events = await recentAutomationEvents(user.organizationId, 15);
  return ok(events);
});
