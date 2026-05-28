import type { NextRequest } from "next/server";
import { z } from "zod";
import { ok } from "@/lib/api-response";
import { withErrorHandling } from "@/server/handler";
import { NotFound } from "@/lib/api-error";
import { prisma } from "@/server/prisma";
import { logAudit } from "@/services/audit";
import { setSessionCookie } from "@/server/session";

const Body = z.object({ userId: z.string().min(1) });

export const POST = withErrorHandling(async (req: NextRequest) => {
  const { userId } = Body.parse(await req.json());
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.archivedAt) throw NotFound("user");

  await setSessionCookie(user.id);
  await logAudit({
    action: "sign_in",
    entityType: "user",
    entityId: user.id,
    actor: { id: user.id, name: user.name, organizationId: user.organizationId },
  });
  return ok({ id: user.id, name: user.name, role: user.role });
});
