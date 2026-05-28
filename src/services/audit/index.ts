import type { AuditAction, Prisma } from "@prisma/client";
import { prisma } from "@/server/prisma";
import { log } from "@/server/logger";

export type Actor = { id?: string | null; name?: string | null } | null;

export type AuditEntry = {
  action: AuditAction;
  entityType: string;
  entityId: string;
  patientId?: string | null;
  actor?: Actor;
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
        patientId: entry.patientId ?? null,
        userId: entry.actor?.id ?? null,
        performedBy: entry.actor?.name ?? "system",
        metadata: entry.metadata,
      },
    });
  } catch (err) {
    log.warn("audit_write_failed", {
      action: entry.action,
      entityType: entry.entityType,
      err: err instanceof Error ? err.message : String(err),
    });
  }
}
