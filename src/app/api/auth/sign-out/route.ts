import { ok } from "@/lib/api-response";
import { withErrorHandling } from "@/server/handler";
import { clearSessionCookie, getCurrentUser } from "@/server/session";
import { logAudit } from "@/services/audit";

export const POST = withErrorHandling(async () => {
  const user = await getCurrentUser();
  if (user) {
    await logAudit({
      action: "sign_out",
      entityType: "user",
      entityId: user.id,
      actor: { id: user.id, name: user.name },
    });
  }
  await clearSessionCookie();
  return ok({ ok: true });
});
