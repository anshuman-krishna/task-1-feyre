import type { NextRequest } from "next/server";
import { ok } from "@/lib/api-response";
import { withErrorHandling } from "@/server/handler";
import { listPatientActivity } from "@/services/activity";

type Ctx = { params: Promise<{ id: string }> };

export const GET = withErrorHandling(async (_req: NextRequest, ctx: Ctx) => {
  const { id } = await ctx.params;
  const rows = await listPatientActivity(id);
  return ok(rows);
});
