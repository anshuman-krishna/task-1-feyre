import type { NextRequest } from "next/server";
import { z } from "zod";
import { ok } from "@/lib/api-response";
import { Unauthorized, BadRequest } from "@/lib/api-error";
import { withErrorHandling } from "@/server/handler";
import { getCurrentUser } from "@/server/session";
import { listAutomationRules, setRuleEnabled } from "@/services/automation";

const ToggleSchema = z.object({ key: z.string().min(1), enabled: z.boolean() });

export const GET = withErrorHandling(async () => {
  const user = await getCurrentUser();
  if (!user) throw Unauthorized();
  const rules = await listAutomationRules(user.organizationId);
  return ok(rules);
});

export const PATCH = withErrorHandling(async (req: NextRequest) => {
  const user = await getCurrentUser();
  if (!user) throw Unauthorized();
  if (user.role !== "admin") throw BadRequest("only admins can toggle rules");
  const body = await req.json().catch(() => ({}));
  const parsed = ToggleSchema.safeParse(body);
  if (!parsed.success) throw BadRequest("invalid payload");
  await setRuleEnabled(user.organizationId, parsed.data.key, parsed.data.enabled);
  return ok({ key: parsed.data.key, enabled: parsed.data.enabled });
});
