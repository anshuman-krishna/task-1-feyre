import type { NextRequest } from "next/server";
import { z } from "zod";
import { ok } from "@/lib/api-response";
import { BadRequest } from "@/lib/api-error";
import { withErrorHandling } from "@/server/handler";
import { requireAdmin } from "@/server/admin";
import { decideApproval } from "@/services/governance";

const Schema = z.object({
  decision: z.enum(["approved", "rejected", "withdrawn"]),
  reason: z.string().max(500).optional(),
});

type Ctx = { params: Promise<{ id: string }> };

export const POST = withErrorHandling(async (req: NextRequest, ctx: Ctx) => {
  const user = await requireAdmin();
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const parsed = Schema.safeParse(body);
  if (!parsed.success) throw BadRequest("invalid payload");
  const approval = await decideApproval({
    approvalId: id,
    state: parsed.data.decision,
    reason: parsed.data.reason,
    actor: { id: user.id, name: user.name, organizationId: user.organizationId },
  });
  return ok(approval);
});
