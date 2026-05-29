import { ok } from "@/lib/api-response";
import { withErrorHandling } from "@/server/handler";
import { requireAdmin } from "@/server/admin";
import { createSnapshot, listSnapshots } from "@/services/backup";

export const GET = withErrorHandling(async () => {
  const user = await requireAdmin();
  const snapshots = await listSnapshots(user.organizationId, 20);
  return ok(snapshots);
});

export const POST = withErrorHandling(async () => {
  const user = await requireAdmin();
  const snapshot = await createSnapshot(user.organizationId, {
    actor: { id: user.id, name: user.name, organizationId: user.organizationId },
  });
  return ok(snapshot);
});
