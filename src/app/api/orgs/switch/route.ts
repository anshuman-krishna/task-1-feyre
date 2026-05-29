import type { NextRequest } from "next/server";
import { z } from "zod";
import { ok } from "@/lib/api-response";
import { BadRequest, Unauthorized } from "@/lib/api-error";
import { withErrorHandling } from "@/server/handler";
import { getCurrentUser, setActiveOrgCookie } from "@/server/session";
import { listMembershipsFor } from "@/services/organization";
import { logAudit } from "@/services/audit";

const Schema = z.object({ organizationId: z.string().min(1) });

export const POST = withErrorHandling(async (req: NextRequest) => {
  const user = await getCurrentUser();
  if (!user) throw Unauthorized();
  const body = await req.json().catch(() => ({}));
  const parsed = Schema.safeParse(body);
  if (!parsed.success) throw BadRequest("invalid payload");

  const memberships = await listMembershipsFor(user.id);
  const target = memberships.find((m) => m.id === parsed.data.organizationId);
  if (!target) throw BadRequest("not a member of that organization");

  await setActiveOrgCookie(target.id);
  await logAudit({
    action: "org_switch",
    entityType: "organization",
    entityId: target.id,
    actor: { id: user.id, name: user.name, organizationId: user.organizationId },
    metadata: { from: user.organizationId, to: target.id },
  });
  return ok({ active: target.id });
});
