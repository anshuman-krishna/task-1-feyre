import { prisma } from "@/server/prisma";

// automation analytics. is the engine helping? these metrics answer that
// without requiring a human to scroll through every fire.

const DAY_MS = 24 * 60 * 60 * 1000;

export type AutomationHealth = {
  totalFires7d: number;
  byRule: { ruleKey: string; ruleName: string; fires: number; lastFiredAt: Date | null }[];
  approvalsRequested: number;
  approvalsAccepted: number;
  approvalsRejected: number;
  acceptanceRate: number | null;
  notificationsGenerated: number;
  confidenceSkipped: number;
};

export async function automationHealth(organizationId: string): Promise<AutomationHealth> {
  const since = new Date(Date.now() - 7 * DAY_MS);
  const [fires, rules, approvals, notifications] = await Promise.all([
    prisma.automationEvent.count({
      where: { organizationId, createdAt: { gte: since } },
    }),
    prisma.automationRule.findMany({
      where: { organizationId },
      select: { key: true, name: true, fireCount: true, lastFiredAt: true },
      orderBy: { fireCount: "desc" },
    }),
    prisma.approval.groupBy({
      by: ["state"],
      where: { organizationId, createdAt: { gte: since } },
      _count: { _all: true },
    }),
    prisma.notification.count({
      where: {
        organizationId,
        type: "automation",
        createdAt: { gte: since },
      },
    }),
  ]);

  const stateCounts = new Map(approvals.map((a) => [a.state, a._count._all]));
  const requested = approvals.reduce((s, a) => s + a._count._all, 0);
  const accepted = stateCounts.get("approved") ?? 0;
  const rejected = stateCounts.get("rejected") ?? 0;
  const acceptanceRate = accepted + rejected === 0 ? null : accepted / (accepted + rejected);

  // confidence skips come from in-memory metrics — fall back to the audit
  // log entries the automation engine writes (rule_toggled etc. are
  // separate). until we persist per-fire confidence, leave the audit
  // surface as the source of truth.
  const confidenceSkipped = await prisma.auditLog.count({
    where: {
      action: "automation_fire",
      createdAt: { gte: since },
      metadata: { path: ["outcome"], equals: "confidence_skipped" } as never,
    },
  });

  return {
    totalFires7d: fires,
    byRule: rules.map((r) => ({
      ruleKey: r.key,
      ruleName: r.name,
      fires: r.fireCount,
      lastFiredAt: r.lastFiredAt,
    })),
    approvalsRequested: requested,
    approvalsAccepted: accepted,
    approvalsRejected: rejected,
    acceptanceRate,
    notificationsGenerated: notifications,
    confidenceSkipped,
  };
}

export type AutomationEffectiveness = {
  totalFires: number;
  byTrigger: { trigger: string; count: number }[];
  avgFiresPerDay: number;
  windowDays: number;
};

export async function automationEffectiveness(
  organizationId: string,
  windowDays = 14,
): Promise<AutomationEffectiveness> {
  const since = new Date(Date.now() - windowDays * DAY_MS);
  const [total, byTrigger] = await Promise.all([
    prisma.automationEvent.count({
      where: { organizationId, createdAt: { gte: since } },
    }),
    prisma.automationEvent.groupBy({
      by: ["trigger"],
      where: { organizationId, createdAt: { gte: since } },
      _count: { _all: true },
    }),
  ]);
  return {
    totalFires: total,
    byTrigger: byTrigger.map((b) => ({ trigger: b.trigger, count: b._count._all })),
    avgFiresPerDay: Number((total / windowDays).toFixed(1)),
    windowDays,
  };
}
