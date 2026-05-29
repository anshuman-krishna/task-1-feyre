import type { NextRequest } from "next/server";
import { z } from "zod";
import { ok } from "@/lib/api-response";
import { BadRequest } from "@/lib/api-error";
import { withErrorHandling } from "@/server/handler";
import { requireAdmin } from "@/server/admin";
import { runSimulation } from "@/services/reliability";

const Schema = z.object({
  kind: z.enum(["queue_burst", "provider_failure", "notification_storm"]),
  intensity: z.number().int().min(1).max(25).optional(),
});

export const POST = withErrorHandling(async (req: NextRequest) => {
  const user = await requireAdmin();
  const body = await req.json().catch(() => ({}));
  const parsed = Schema.safeParse(body);
  if (!parsed.success) throw BadRequest("invalid payload");
  const result = await runSimulation(parsed.data.kind, {
    organizationId: user.organizationId,
    actor: { id: user.id, name: user.name, organizationId: user.organizationId },
    intensity: parsed.data.intensity,
  });
  return ok(result);
});
