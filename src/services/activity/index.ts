import type { AuditAction, AuditLog, Prisma } from "@prisma/client";
import { prisma } from "@/server/prisma";

export type ActivityEntry = {
  id: string;
  action: AuditAction;
  patientId: string | null;
  patientName: string | null;
  performedBy: string | null;
  metadata: Prisma.JsonValue;
  createdAt: Date;
};

type Row = AuditLog & { patient: { fullName: string } | null };

function toEntry(row: Row): ActivityEntry {
  return {
    id: row.id,
    action: row.action,
    patientId: row.patientId,
    patientName: row.patient?.fullName ?? null,
    performedBy: row.performedBy,
    metadata: row.metadata as Prisma.JsonValue,
    createdAt: row.createdAt,
  };
}

export async function listActivity(limit = 20): Promise<ActivityEntry[]> {
  const rows = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { patient: { select: { fullName: true } } },
  });
  return rows.map(toEntry);
}

export async function listPatientActivity(patientId: string, limit = 30): Promise<ActivityEntry[]> {
  const rows = await prisma.auditLog.findMany({
    where: { patientId },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { patient: { select: { fullName: true } } },
  });
  return rows.map(toEntry);
}
