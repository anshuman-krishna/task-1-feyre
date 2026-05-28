import type { NextRequest } from "next/server";
import { ok, fail } from "@/lib/api-response";
import { withErrorHandling } from "@/server/handler";
import { executePrediction } from "@/services/prediction";

type Ctx = { params: Promise<{ id: string }> };

export const POST = withErrorHandling(async (_req: NextRequest, ctx: Ctx) => {
  const { id } = await ctx.params;
  const outcome = await executePrediction(id);
  if (!outcome) return fail("prediction could not be executed", 422, "prediction_failed");
  return ok(outcome);
});
