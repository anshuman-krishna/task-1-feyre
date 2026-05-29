import { ok } from "@/lib/api-response";
import { Unauthorized } from "@/lib/api-error";
import { withErrorHandling } from "@/server/handler";
import { getCurrentUser } from "@/server/session";
import { suggestAssignees } from "@/services/assignment";

type Ctx = { params: Promise<{ id: string }> };

export const GET = withErrorHandling(async (_req, ctx: Ctx) => {
  const user = await getCurrentUser();
  if (!user) throw Unauthorized();
  const { id } = await ctx.params;
  const suggestions = await suggestAssignees(user.organizationId, { patientId: id });
  return ok(suggestions);
});
