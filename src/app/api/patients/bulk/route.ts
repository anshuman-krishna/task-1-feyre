import type { NextRequest } from "next/server";
import { z } from "zod";
import { ok } from "@/lib/api-response";
import { withErrorHandling } from "@/server/handler";
import { prisma } from "@/server/prisma";
import { logAudit } from "@/services/audit";
import { getCurrentUser } from "@/server/session";
import { WorkflowStatusSchema } from "@/features/patients/schema";

const BulkSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("archive"), ids: z.array(z.string()).min(1).max(200) }),
  z.object({
    action: z.literal("status"),
    ids: z.array(z.string()).min(1).max(200),
    status: WorkflowStatusSchema,
  }),
]);

export const POST = withErrorHandling(async (req: NextRequest) => {
  const user = await getCurrentUser();
  const body = await req.json();
  const input = BulkSchema.parse(body);
  const actor = user ? { id: user.id, name: user.name, organizationId: user.organizationId } : null;

  if (input.action === "archive") {
    const result = await prisma.patient.updateMany({
      where: { id: { in: input.ids }, archivedAt: null },
      data: { archivedAt: new Date() },
    });
    await logAudit({
      action: "bulk_archive",
      entityType: "patient",
      entityId: "many",
      actor,
      metadata: { ids: input.ids, count: result.count },
    });
    return ok({ count: result.count });
  }

  // status
  const result = await prisma.patient.updateMany({
    where: { id: { in: input.ids }, archivedAt: null },
    data: { status: input.status, reviewedAt: new Date() },
  });
  await logAudit({
    action: "bulk_status",
    entityType: "patient",
    entityId: "many",
    actor,
    metadata: { ids: input.ids, status: input.status, count: result.count },
  });
  return ok({ count: result.count });
});
