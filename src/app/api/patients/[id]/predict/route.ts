import type { NextRequest } from "next/server";
import { ok } from "@/lib/api-response";
import { withErrorHandling } from "@/server/handler";
import { getCurrentUser } from "@/server/session";
import { enqueuePrediction } from "@/services/queue/prediction";

type Ctx = { params: Promise<{ id: string }> };

export const POST = withErrorHandling(async (_req: NextRequest, ctx: Ctx) => {
  const { id } = await ctx.params;
  const user = await getCurrentUser();
  const job = await enqueuePrediction(id, {
    actor: user ? { id: user.id, name: user.name, organizationId: user.organizationId } : null,
  });
  return ok({ jobId: job.id, status: job.status }, { status: 202 });
});
