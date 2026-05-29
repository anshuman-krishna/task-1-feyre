import type { NextRequest } from "next/server";
import type { PolicyKind } from "@prisma/client";
import { z } from "zod";
import { ok } from "@/lib/api-response";
import { BadRequest } from "@/lib/api-error";
import { withErrorHandling } from "@/server/handler";
import { requireAdmin } from "@/server/admin";
import { listPolicies, setPolicy } from "@/services/governance";

const Schema = z.object({
  kind: z.enum(["notification", "escalation", "retention", "assignment", "confidence", "approval"]),
  config: z.record(z.unknown()),
  enabled: z.boolean().optional(),
});

export const GET = withErrorHandling(async () => {
  const user = await requireAdmin();
  const policies = await listPolicies(user.organizationId);
  return ok(policies);
});

export const PATCH = withErrorHandling(async (req: NextRequest) => {
  const user = await requireAdmin();
  const body = await req.json().catch(() => ({}));
  const parsed = Schema.safeParse(body);
  if (!parsed.success) throw BadRequest("invalid policy payload");
  const policy = await setPolicy({
    organizationId: user.organizationId,
    kind: parsed.data.kind as PolicyKind,
    config: parsed.data.config,
    enabled: parsed.data.enabled,
    actor: { id: user.id, name: user.name, organizationId: user.organizationId },
  });
  return ok(policy);
});
