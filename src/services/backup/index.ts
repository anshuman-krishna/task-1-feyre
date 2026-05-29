import type { Prisma } from "@prisma/client";
import { prisma } from "@/server/prisma";
import { metrics } from "@/server/metrics";
import { logAudit, type Actor } from "@/services/audit";

// disaster-recovery foundations. v1 captures a JSON digest of workspace
// state at point-in-time — counts by kind, queue depth, recent activity.
// real cloud backups land later; this is the contract for what we'd
// capture and how recovery would index into it.

export type SnapshotKind = "manual" | "scheduled" | "pre_change";

export async function createSnapshot(
  organizationId: string,
  opts: { label?: string; kind?: SnapshotKind; actor?: Actor } = {},
) {
  const digest = await buildDigest(organizationId);
  const label = opts.label ?? `${opts.kind ?? "manual"}-${new Date().toISOString().slice(0, 19)}`;
  const bytes = Buffer.byteLength(JSON.stringify(digest));

  const row = await prisma.backupSnapshot.create({
    data: {
      organizationId,
      label,
      kind: opts.kind ?? "manual",
      digest: digest as unknown as Prisma.InputJsonValue,
      bytes,
      createdById: opts.actor?.id ?? null,
    },
  });

  await logAudit({
    action: "backup_created",
    entityType: "backup_snapshot",
    entityId: row.id,
    actor: opts.actor,
    metadata: { label, kind: row.kind, bytes },
  });
  metrics.inc("backups_created", { kind: row.kind });
  return row;
}

export async function listSnapshots(organizationId: string, limit = 20) {
  return prisma.backupSnapshot.findMany({
    where: { organizationId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

export async function lastSnapshot(organizationId: string) {
  return prisma.backupSnapshot.findFirst({
    where: { organizationId },
    orderBy: { createdAt: "desc" },
  });
}

async function buildDigest(organizationId: string) {
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [
    patients,
    activePatients,
    criticalPatients,
    users,
    queueDepth,
    notifications,
    audit24h,
    aiRuns7d,
    automationEvents7d,
    summaries,
    approvals,
  ] = await Promise.all([
    prisma.patient.count({ where: { organizationId } }),
    prisma.patient.count({ where: { organizationId, archivedAt: null } }),
    prisma.patient.count({
      where: { organizationId, archivedAt: null, riskLevel: "critical" },
    }),
    prisma.user.count({ where: { organizationId } }),
    prisma.predictionJob.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.notification.count({ where: { organizationId } }),
    prisma.auditLog.count({ where: { createdAt: { gte: dayAgo } } }),
    prisma.aIRun.count({ where: { organizationId, createdAt: { gte: weekAgo } } }),
    prisma.automationEvent.count({
      where: { organizationId, createdAt: { gte: weekAgo } },
    }),
    prisma.patientSummary.count({ where: { patient: { organizationId } } }),
    prisma.approval.count({ where: { organizationId } }),
  ]);

  return {
    capturedAt: new Date().toISOString(),
    organizationId,
    patients: { total: patients, active: activePatients, critical: criticalPatients },
    users: { total: users },
    queue: Object.fromEntries(queueDepth.map((g) => [g.status, g._count._all])),
    notifications,
    audit24h,
    aiRuns7d,
    automationEvents7d,
    summaries,
    approvals,
  };
}
