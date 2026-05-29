import type { PolicyKind, Prisma } from "@prisma/client";
import { prisma } from "@/server/prisma";
import { metrics } from "@/server/metrics";
import { logAudit, type Actor } from "@/services/audit";

// policy engine v1. policies are JSON config keyed by (orgId, kind).
// a built-in defaults registry ships in code; the row overrides defaults
// when present. callers should always go through policyConfig() so the
// defaults stay authoritative and there's exactly one read path.

export type PolicyConfig = Record<string, unknown>;

export const POLICY_DEFAULTS: Record<PolicyKind, PolicyConfig> = {
  notification: {
    bellRefreshSeconds: 60,
    deduplicateMinutes: 60,
    suppressBelowPriority: "normal",
  },
  escalation: {
    autoEscalateAfterDays: 2,
    onlyFromSoftStates: true,
    notifyAssigneeOnEscalation: true,
  },
  retention: {
    archivedRetentionDays: 365,
    auditRetentionDays: 1095,
    summaryRetentionRevisions: 12,
  },
  assignment: {
    maxActivePerClinician: 80,
    rebalanceWhenOverloaded: true,
  },
  confidence: {
    minSummaryConfidence: 0.6,
    minAutomationConfidence: 0.55,
    flagLowConfidence: true,
  },
  approval: {
    summariesRequireApproval: false,
    workflowEscalationRequiresApproval: false,
    automationActionRequiresApproval: false,
  },
};

export const POLICY_DESCRIPTIONS: Record<PolicyKind, string> = {
  notification: "Bell behaviour, dedupe windows, and priority suppression thresholds.",
  escalation: "When and how the automation engine escalates workflow states.",
  retention: "How long archived patients, audit rows, and summaries are kept.",
  assignment: "Clinician load caps and rebalancing posture.",
  confidence: "Confidence thresholds for AI surfaces and automation gates.",
  approval: "Which actions require human approval before taking effect.",
};

export async function policyConfig(
  organizationId: string,
  kind: PolicyKind,
): Promise<PolicyConfig> {
  metrics.inc("policy_reads", { kind });
  const row = await prisma.policy.findUnique({
    where: { organizationId_kind: { organizationId, kind } },
  });
  if (!row || !row.enabled) return POLICY_DEFAULTS[kind];
  return { ...POLICY_DEFAULTS[kind], ...(row.config as PolicyConfig) };
}

export async function listPolicies(organizationId: string) {
  const rows = await prisma.policy.findMany({
    where: { organizationId },
  });
  const map: Record<string, (typeof rows)[number]> = {};
  for (const r of rows) map[r.kind] = r;
  return (Object.keys(POLICY_DEFAULTS) as PolicyKind[]).map((kind) => {
    const row = map[kind];
    return {
      kind,
      description: POLICY_DESCRIPTIONS[kind],
      enabled: row?.enabled ?? true,
      revision: row?.revision ?? 0,
      defaults: POLICY_DEFAULTS[kind],
      config: (row?.config ?? POLICY_DEFAULTS[kind]) as PolicyConfig,
      updatedAt: row?.updatedAt ?? null,
      lastEditedBy: row?.lastEditedBy ?? null,
    };
  });
}

export type SetPolicyInput = {
  organizationId: string;
  kind: PolicyKind;
  config: PolicyConfig;
  enabled?: boolean;
  actor?: Actor;
};

export async function setPolicy(input: SetPolicyInput) {
  const existing = await prisma.policy.findUnique({
    where: { organizationId_kind: { organizationId: input.organizationId, kind: input.kind } },
  });
  const nextRevision = (existing?.revision ?? 0) + 1;

  const row = await prisma.policy.upsert({
    where: { organizationId_kind: { organizationId: input.organizationId, kind: input.kind } },
    create: {
      organizationId: input.organizationId,
      kind: input.kind,
      config: input.config as unknown as Prisma.InputJsonValue,
      description: POLICY_DESCRIPTIONS[input.kind],
      enabled: input.enabled ?? true,
      revision: 1,
      lastEditedBy: input.actor?.id ?? null,
    },
    update: {
      config: input.config as unknown as Prisma.InputJsonValue,
      enabled: input.enabled ?? existing?.enabled ?? true,
      revision: nextRevision,
      lastEditedBy: input.actor?.id ?? null,
    },
  });

  await logAudit({
    action: "policy_change",
    entityType: "policy",
    entityId: input.kind,
    actor: input.actor,
    metadata: {
      kind: input.kind,
      revision: nextRevision,
      enabled: row.enabled,
    },
  });

  metrics.inc("policy_writes", { kind: input.kind });
  return row;
}
