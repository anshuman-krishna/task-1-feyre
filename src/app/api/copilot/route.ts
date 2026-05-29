import type { NextRequest } from "next/server";
import { z } from "zod";
import { ok } from "@/lib/api-response";
import { BadRequest, Unauthorized } from "@/lib/api-error";
import { withErrorHandling } from "@/server/handler";
import { getCurrentUser } from "@/server/session";
import { runCopilot } from "@/services/copilot";

const ActionSchema = z.object({
  action: z.enum(["urgent_review", "unresolved_criticals", "clinician_handoff"]),
});

export const POST = withErrorHandling(async (req: NextRequest) => {
  const user = await getCurrentUser();
  if (!user) throw Unauthorized();
  const body = await req.json().catch(() => ({}));
  const parsed = ActionSchema.safeParse(body);
  if (!parsed.success) throw BadRequest("invalid copilot action");
  const result = await runCopilot(parsed.data.action, {
    organizationId: user.organizationId,
    actor: { id: user.id, name: user.name, organizationId: user.organizationId },
  });
  return ok(result);
});
