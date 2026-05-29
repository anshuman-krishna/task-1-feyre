import type { NextRequest } from "next/server";
import { ok } from "@/lib/api-response";
import { Unauthorized } from "@/lib/api-error";
import { withErrorHandling } from "@/server/handler";
import { getCurrentUser } from "@/server/session";
import { publishPatientSummary } from "@/services/ai/summarizers/patient";

type Ctx = { params: Promise<{ id: string }> };

export const POST = withErrorHandling(async (_req: NextRequest, ctx: Ctx) => {
  const user = await getCurrentUser();
  if (!user) throw Unauthorized();
  const { id } = await ctx.params;
  const published = await publishPatientSummary(id, {
    id: user.id,
    name: user.name,
    organizationId: user.organizationId,
  });
  return ok(published);
});
