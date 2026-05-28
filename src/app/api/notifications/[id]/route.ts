import type { NextRequest } from "next/server";
import { ok } from "@/lib/api-response";
import { withErrorHandling } from "@/server/handler";
import { Unauthorized } from "@/lib/api-error";
import { markRead } from "@/services/notification";
import { getCurrentUser } from "@/server/session";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = withErrorHandling(async (_req: NextRequest, ctx: Ctx) => {
  const { id } = await ctx.params;
  const user = await getCurrentUser();
  if (!user) throw Unauthorized();
  const result = await markRead(user.id, [id]);
  return ok(result);
});
