import { prisma } from "@/server/prisma";
import { logAudit } from "@/services/audit";
import { metrics } from "@/server/metrics";
import { policyConfig } from "./policy";

// retention sweep. archives patients whose retentionUntil has passed and
// prunes old audit + summary revisions per the retention policy. designed
// to be safe to re-run (idempotent for already-archived rows).

export type RetentionResult = {
  patientsArchived: number;
  auditPruned: number;
  revisionsPruned: number;
};

export async function runRetentionSweep(organizationId: string): Promise<RetentionResult> {
  const cfg = await policyConfig(organizationId, "retention");
  const archiveDays = Number(cfg.archivedRetentionDays ?? 365);
  const auditDays = Number(cfg.auditRetentionDays ?? 1095);
  const revisionKeep = Number(cfg.summaryRetentionRevisions ?? 12);

  const now = new Date();

  const expired = await prisma.patient.findMany({
    where: {
      organizationId,
      archivedAt: null,
      retentionUntil: { not: null, lte: now },
    },
    select: { id: true },
  });
  if (expired.length > 0) {
    await prisma.patient.updateMany({
      where: { id: { in: expired.map((p) => p.id) } },
      data: { archivedAt: now },
    });
    for (const p of expired) {
      await logAudit({
        action: "archive",
        entityType: "patient",
        entityId: p.id,
        patientId: p.id,
        metadata: { auto: true, reason: "retention_until_expired" },
      });
    }
  }

  const auditCutoff = new Date(now.getTime() - auditDays * 24 * 60 * 60 * 1000);
  const auditPruned = await prisma.auditLog.deleteMany({
    where: { createdAt: { lt: auditCutoff } },
  });

  // keep only the latest `revisionKeep` revisions per patient
  const revisionsPruned = await pruneSummaryRevisions(organizationId, revisionKeep);

  const result = {
    patientsArchived: expired.length,
    auditPruned: auditPruned.count,
    revisionsPruned,
  };

  metrics.inc("retention_sweeps");
  return result;
}

async function pruneSummaryRevisions(
  organizationId: string,
  keep: number,
): Promise<number> {
  const patients = await prisma.patient.findMany({
    where: { organizationId },
    select: { id: true },
  });
  let total = 0;
  for (const p of patients) {
    const newest = await prisma.summaryRevision.findMany({
      where: { patientId: p.id },
      orderBy: { revision: "desc" },
      take: keep,
      select: { id: true },
    });
    const keepIds = new Set(newest.map((n) => n.id));
    if (keepIds.size === 0) continue;
    const purged = await prisma.summaryRevision.deleteMany({
      where: { patientId: p.id, id: { notIn: Array.from(keepIds) } },
    });
    total += purged.count;
  }
  return total;
}
