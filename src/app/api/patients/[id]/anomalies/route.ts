import { ok } from "@/lib/api-response";
import { Unauthorized } from "@/lib/api-error";
import { withErrorHandling } from "@/server/handler";
import { getCurrentUser } from "@/server/session";
import { detectAnomalies } from "@/services/anomaly";

type Ctx = { params: Promise<{ id: string }> };

export const GET = withErrorHandling(async (_req, ctx: Ctx) => {
  const user = await getCurrentUser();
  if (!user) throw Unauthorized();
  const { id } = await ctx.params;
  const signals = await detectAnomalies(id);
  return ok(signals);
});
