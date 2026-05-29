import type { NextRequest } from "next/server";
import { ok } from "@/lib/api-response";
import { withErrorHandling } from "@/server/handler";
import { Unauthorized } from "@/lib/api-error";
import { getCurrentUser } from "@/server/session";
import { patientLineage } from "@/services/governance";

type Ctx = { params: Promise<{ patientId: string }> };

export const GET = withErrorHandling(async (_req: NextRequest, ctx: Ctx) => {
  const user = await getCurrentUser();
  if (!user) throw Unauthorized();
  const { patientId } = await ctx.params;
  const lineage = await patientLineage(patientId);
  return ok(lineage);
});
