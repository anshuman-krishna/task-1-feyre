import type { AuditAction, Prisma } from "@prisma/client";
import { prisma } from "@/server/prisma";

export type AuditEntry = {
  action: AuditAction;
  entityType: string;
  entityId: string;
  patientId?: string;
  performedBy?: string;
  metadata?: Prisma.InputJsonValue;
};

// fire-and-record. swallows errors so audit failure never breaks a write.
export async function logAudit(entry: AuditEntry) {
  try {
    await prisma.auditLog.create({
      data: {
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        patientId: entry.patientId,
        performedBy: entry.performedBy,
        metadata: entry.metadata,
      },
    });
  } catch (err) {
    if (process.env.NODE_ENV === "development") {
      // eslint-disable-next-line no-console
      console.warn("[audit] write failed", err);
    }
  }
}
