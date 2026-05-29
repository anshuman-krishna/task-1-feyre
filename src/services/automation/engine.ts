import type { AutomationTrigger, Prisma } from "@prisma/client";
import { prisma } from "@/server/prisma";
import { events } from "@/server/events";
import { log } from "@/server/logger";
import { metrics } from "@/server/metrics";
import { logAudit } from "@/services/audit";
import { tenantOf } from "@/services/tenant";
import { policyConfig, requestApproval } from "@/services/governance";
import { executeAction } from "./actions";
import { BUILTIN_RULES } from "./rules";
import type {
  AutomationContext,
  AutomationRule,
  AutomationRunResult,
} from "./types";

// trigger evaluation entry. for every built-in rule matching the trigger,
// the engine consults the rule's `evaluate` function for a reason string,
// runs each action, and writes a single AutomationEvent + audit row.

type FireOpts = {
  organizationId?: string;
  patientId?: string | null;
  payload?: Record<string, unknown>;
};

export async function fireAutomation(
  trigger: AutomationTrigger,
  opts: FireOpts = {},
): Promise<AutomationRunResult[]> {
  const organizationId = opts.organizationId ?? tenantOf(null);
  const ctx: AutomationContext = {
    trigger,
    patientId: opts.patientId ?? null,
    organizationId,
    payload: opts.payload ?? {},
  };

  const candidates = BUILTIN_RULES.filter((r) => r.trigger === trigger);
  if (candidates.length === 0) return [];

  // enablement is sourced from the per-org rule table; rules absent from
  // the table default to enabled. this lets the engine work out-of-the-box
  // on a fresh seed before an admin has touched anything.
  const persisted = await prisma.automationRule.findMany({
    where: { organizationId, key: { in: candidates.map((r) => r.key) } },
    select: { key: true, enabled: true },
  });
  const enabledMap: Record<string, boolean> = {};
  for (const p of persisted) enabledMap[p.key] = p.enabled;

  const confidence = await policyConfig(organizationId, "confidence");
  const minAuto = (confidence as Record<string, unknown>).minAutomationConfidence as
    | number
    | undefined;

  const results: AutomationRunResult[] = [];
  for (const rule of candidates) {
    if (enabledMap[rule.key] === false) continue;
    const reason = rule.evaluate(ctx);
    if (!reason) continue;
    if (!passesConfidenceGate(ctx, minAuto)) {
      metrics.inc("automation_confidence_skipped", { rule: rule.key });
      continue;
    }
    try {
      const result = await runRule(rule, ctx, reason);
      results.push(result);
    } catch (err) {
      log.error("automation.run.failed", {
        ruleKey: rule.key,
        trigger,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }
  return results;
}

function passesConfidenceGate(
  ctx: AutomationContext,
  threshold: number | undefined,
): boolean {
  if (threshold == null) return true;
  const c = ctx.payload.confidence as number | undefined;
  // gate only applies when confidence was carried on the payload — rules
  // triggered by deterministic signals (overdue, dead-letter) never set
  // it, so they're never blocked.
  if (typeof c !== "number") return true;
  return c >= threshold;
}

async function runRule(
  rule: AutomationRule,
  ctx: AutomationContext,
  reason: string,
): Promise<AutomationRunResult> {
  // optional approval gate. when the approval policy says actions of this
  // shape require approval, we open an Approval row instead of executing,
  // and emit the AutomationEvent in "awaiting" form so it shows up in
  // the dashboard with the correct posture.
  const approvalCfg = await policyConfig(ctx.organizationId, "approval");
  const requiresApproval =
    rule.trigger === "critical_unreviewed"
      ? Boolean((approvalCfg as Record<string, unknown>).workflowEscalationRequiresApproval)
      : rule.actions.some((a) => a.kind === "escalate_status") &&
        Boolean((approvalCfg as Record<string, unknown>).automationActionRequiresApproval);

  if (requiresApproval) {
    const approval = await requestApproval({
      organizationId: ctx.organizationId,
      kind: "automation_action",
      targetType: "automation_rule",
      targetId: rule.key,
      patientId: ctx.patientId,
      reason: `${rule.name}: ${reason}`,
      payload: { trigger: ctx.trigger, payload: ctx.payload } as Prisma.InputJsonValue,
    });
    metrics.inc("automation_awaiting_approval", { rule: rule.key });
    return {
      ruleKey: rule.key,
      ruleName: rule.name,
      trigger: ctx.trigger,
      patientId: ctx.patientId,
      reason,
      actionsFired: [],
      outcome: { awaitingApproval: true, approvalId: approval.id },
    };
  }

  const outcomes: { kind: string; ok: boolean; detail?: string }[] = [];
  for (const action of rule.actions) {
    const outcome = await executeAction(action, ctx, rule.name, reason);
    outcomes.push(outcome);
  }
  const actionsFired = outcomes.filter((o) => o.ok).map((o) => o.kind);

  await prisma.automationEvent.create({
    data: {
      organizationId: ctx.organizationId,
      ruleKey: rule.key,
      ruleName: rule.name,
      trigger: ctx.trigger,
      patientId: ctx.patientId,
      reason,
      actions: outcomes as unknown as Prisma.InputJsonValue,
      outcome: { actionsFired } as unknown as Prisma.InputJsonValue,
    },
  });

  // ensure a persisted rule row exists so the admin UI can toggle it.
  // upsert is cheap and idempotent.
  await prisma.automationRule.upsert({
    where: { organizationId_key: { organizationId: ctx.organizationId, key: rule.key } },
    create: {
      organizationId: ctx.organizationId,
      key: rule.key,
      name: rule.name,
      description: rule.description,
      trigger: rule.trigger,
      actions: rule.actions as unknown as Prisma.InputJsonValue,
      enabled: true,
      lastFiredAt: new Date(),
      fireCount: 1,
    },
    update: {
      lastFiredAt: new Date(),
      fireCount: { increment: 1 },
    },
  });

  await logAudit({
    action: "automation_fire",
    entityType: "automation_rule",
    entityId: rule.key,
    patientId: ctx.patientId,
    metadata: {
      rule: rule.name,
      trigger: ctx.trigger,
      reason,
      actions: actionsFired,
    },
  });

  metrics.inc("automation_fired_total", { rule: rule.key, trigger: ctx.trigger });
  events.emit("automation.fired", {
    ruleKey: rule.key,
    trigger: ctx.trigger,
    patientId: ctx.patientId,
    actions: actionsFired,
  });

  return {
    ruleKey: rule.key,
    ruleName: rule.name,
    trigger: ctx.trigger,
    patientId: ctx.patientId,
    reason,
    actionsFired,
    outcome: { outcomes },
  };
}

// returns recent automation events with patient context for the dashboard.
export async function recentAutomationEvents(organizationId: string, limit = 12) {
  return prisma.automationEvent.findMany({
    where: { organizationId },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { patient: { select: { id: true, fullName: true } } },
  });
}

export async function listAutomationRules(organizationId: string) {
  const persisted = await prisma.automationRule.findMany({
    where: { organizationId },
  });
  const persistedMap: Record<string, (typeof persisted)[number]> = {};
  for (const p of persisted) persistedMap[p.key] = p;

  return BUILTIN_RULES.map((r) => {
    const row = persistedMap[r.key];
    return {
      key: r.key,
      name: r.name,
      description: r.description,
      trigger: r.trigger,
      actions: r.actions,
      enabled: row?.enabled ?? true,
      fireCount: row?.fireCount ?? 0,
      lastFiredAt: row?.lastFiredAt ?? null,
    };
  });
}

export async function setRuleEnabled(
  organizationId: string,
  key: string,
  enabled: boolean,
) {
  const rule = BUILTIN_RULES.find((r) => r.key === key);
  if (!rule) throw new Error(`unknown rule ${key}`);
  await prisma.automationRule.upsert({
    where: { organizationId_key: { organizationId, key } },
    create: {
      organizationId,
      key: rule.key,
      name: rule.name,
      description: rule.description,
      trigger: rule.trigger,
      actions: rule.actions as unknown as Prisma.InputJsonValue,
      enabled,
    },
    update: { enabled },
  });
}
