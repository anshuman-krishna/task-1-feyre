import { prisma } from "@/server/prisma";

// workload-aware assignment suggestions. inputs: clinician caseload,
// unresolved-critical pressure, follow-up backlog, recent activity.
// the output is a ranked list of clinicians with a one-line reason.
// the human still picks — the system never assigns silently.

export type AssignmentSuggestion = {
  userId: string;
  name: string;
  role: string;
  avatarHue: number;
  load: {
    active: number;
    critical: number;
    overdueFollowUps: number;
    recentActivity: number;
  };
  score: number;
  reason: string;
};

export async function suggestAssignees(
  organizationId: string,
  opts: { patientId?: string; max?: number } = {},
): Promise<AssignmentSuggestion[]> {
  const clinicians = await prisma.user.findMany({
    where: {
      organizationId,
      archivedAt: null,
      role: { in: ["clinician", "admin"] },
    },
    select: { id: true, name: true, role: true, avatarHue: true },
  });

  const now = new Date();
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const suggestions: AssignmentSuggestion[] = [];

  for (const c of clinicians) {
    const [active, critical, overdueFollowUps, recentActivity] = await Promise.all([
      prisma.patient.count({
        where: { organizationId, assignedToId: c.id, archivedAt: null },
      }),
      prisma.patient.count({
        where: {
          organizationId,
          assignedToId: c.id,
          archivedAt: null,
          riskLevel: "critical",
          OR: [{ reviewedAt: null }, { reviewedAt: { lt: dayAgo } }],
        },
      }),
      prisma.patient.count({
        where: {
          organizationId,
          assignedToId: c.id,
          archivedAt: null,
          followUpAt: { lte: now },
        },
      }),
      prisma.auditLog.count({
        where: { userId: c.id, createdAt: { gte: dayAgo } },
      }),
    ]);

    const load = { active, critical, overdueFollowUps, recentActivity };
    // lower score = better candidate. reflects pressure + recency.
    const score =
      active * 2 + critical * 8 + overdueFollowUps * 4 - Math.min(recentActivity, 6) * 0.5;

    const reason = composeReason(load);
    suggestions.push({
      userId: c.id,
      name: c.name,
      role: c.role,
      avatarHue: c.avatarHue,
      load,
      score,
      reason,
    });
  }

  suggestions.sort((a, b) => a.score - b.score);

  // never recommend the current assignee at position 0 when the patient id is provided
  if (opts.patientId) {
    const current = await prisma.patient.findUnique({
      where: { id: opts.patientId },
      select: { assignedToId: true },
    });
    if (current?.assignedToId) {
      const idx = suggestions.findIndex((s) => s.userId === current.assignedToId);
      if (idx === 0 && suggestions.length > 1) {
        const [head, ...rest] = suggestions;
        suggestions.length = 0;
        suggestions.push(rest[0]!, head!, ...rest.slice(1));
      }
    }
  }

  return suggestions.slice(0, opts.max ?? 5);
}

function composeReason(load: AssignmentSuggestion["load"]): string {
  const segments: string[] = [];
  segments.push(`${load.active} active`);
  if (load.critical > 0) segments.push(`${load.critical} critical`);
  if (load.overdueFollowUps > 0) segments.push(`${load.overdueFollowUps} overdue`);
  if (load.recentActivity > 0) segments.push(`${load.recentActivity} actions today`);
  return segments.join(" · ");
}
