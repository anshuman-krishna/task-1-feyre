import { ok } from "@/lib/api-response";
import { withErrorHandling } from "@/server/handler";
import { requireAdmin } from "@/server/admin";
import { listApprovals } from "@/services/governance";

export const GET = withErrorHandling(async () => {
  const user = await requireAdmin();
  const approvals = await listApprovals(user.organizationId, { limit: 60 });
  return ok(approvals);
});
