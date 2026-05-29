import { ok } from "@/lib/api-response";
import { withErrorHandling } from "@/server/handler";
import { requireAdmin } from "@/server/admin";
import { runRetentionSweep } from "@/services/governance/retention";

export const POST = withErrorHandling(async () => {
  const user = await requireAdmin();
  const result = await runRetentionSweep(user.organizationId);
  return ok(result);
});
