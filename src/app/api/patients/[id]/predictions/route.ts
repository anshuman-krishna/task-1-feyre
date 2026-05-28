import type { NextRequest } from "next/server";
import { ok } from "@/lib/api-response";
import { withErrorHandling } from "@/server/handler";
import { getPredictionHistory } from "@/services/prediction";

type Ctx = { params: Promise<{ id: string }> };

export const GET = withErrorHandling(async (req: NextRequest, ctx: Ctx) => {
  const { id } = await ctx.params;
  const limit = Number(req.nextUrl.searchParams.get("limit") ?? "20");
  const rows = await getPredictionHistory(id, Math.min(100, Math.max(1, limit)));
  return ok(rows);
});
