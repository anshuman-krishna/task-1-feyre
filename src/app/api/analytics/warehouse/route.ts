import { withErrorHandling } from "@/server/handler";
import { requireAdmin } from "@/server/admin";
import { ok } from "@/lib/api-response";
import { runWarehouse } from "@/services/analytics";
import { logAudit } from "@/services/audit";

export const POST = withErrorHandling(async () => {
  const user = await requireAdmin();
  const result = await runWarehouse(user.organizationId);
  await logAudit({
    action: "export",
    entityType: "analytics_warehouse",
    entityId: user.organizationId,
    actor: { id: user.id, name: user.name, organizationId: user.organizationId },
    metadata: {
      durationMs: result.durationMs,
      steps: result.steps.length,
    },
  });
  return ok(result);
});
