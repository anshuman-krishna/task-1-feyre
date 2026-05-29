import { withErrorHandling } from "@/server/handler";
import { requireAdmin } from "@/server/admin";
import { ok } from "@/lib/api-response";
import { captureDailySnapshot } from "@/services/analytics";
import { logAudit } from "@/services/audit";

export const POST = withErrorHandling(async () => {
  const user = await requireAdmin();
  const result = await captureDailySnapshot(user.organizationId);
  await logAudit({
    action: "export",
    entityType: "analytics_snapshot",
    entityId: result.snapshot.id,
    actor: { id: user.id, name: user.name, organizationId: user.organizationId },
    metadata: { capturedFor: result.snapshot.capturedFor },
  });
  return ok({
    capturedFor: result.snapshot.capturedFor,
    durationMs: result.snapshot.durationMs,
    metrics: result.row,
  });
});
