import { ok } from "@/lib/api-response";
import { Unauthorized } from "@/lib/api-error";
import { withErrorHandling } from "@/server/handler";
import { getCurrentUser } from "@/server/session";
import { listMembershipsFor } from "@/services/organization";

export const GET = withErrorHandling(async () => {
  const user = await getCurrentUser();
  if (!user) throw Unauthorized();
  const memberships = await listMembershipsFor(user.id);
  return ok({ active: user.organizationId, memberships });
});
