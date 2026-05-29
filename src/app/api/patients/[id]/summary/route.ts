import { ok } from "@/lib/api-response";
import { Unauthorized } from "@/lib/api-error";
import { withErrorHandling } from "@/server/handler";
import { getCurrentUser } from "@/server/session";
import { getPatientSummary, refreshPatientSummary } from "@/services/ai";

type Ctx = { params: Promise<{ id: string }> };

export const GET = withErrorHandling(async (_req, ctx: Ctx) => {
  const user = await getCurrentUser();
  if (!user) throw Unauthorized();
  const { id } = await ctx.params;
  const summary = await getPatientSummary(id);
  return ok(summary);
});

export const POST = withErrorHandling(async (_req, ctx: Ctx) => {
  const user = await getCurrentUser();
  if (!user) throw Unauthorized();
  const { id } = await ctx.params;
  const summary = await refreshPatientSummary(id, {
    actor: { id: user.id, name: user.name, organizationId: user.organizationId },
    force: true,
    reason: "manual",
  });
  return ok(summary);
});
