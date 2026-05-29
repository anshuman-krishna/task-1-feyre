import type { NotificationPriority, WorkflowStatus } from "@prisma/client";
import { prisma } from "@/server/prisma";
import { events } from "@/server/events";
import { createNotification } from "@/services/notification";
import { refreshPatientSummary } from "@/services/ai";
import { logAudit } from "@/services/audit";
import type { AutomationActionSpec, AutomationContext } from "./types";

// action executors. each returns a small descriptor for the AutomationEvent
// outcome json. they are intentionally narrow — automation should never
// fan out side-effects beyond the contract.

export async function executeAction(
  spec: AutomationActionSpec,
  ctx: AutomationContext,
  ruleName: string,
  reason: string,
): Promise<{ kind: string; ok: boolean; detail?: string }> {
  switch (spec.kind) {
    case "notify":
      return notifyAction(spec, ctx, ruleName, reason);
    case "escalate_status":
      return escalateAction(spec, ctx, ruleName, reason);
    case "refresh_summary":
      return refreshSummaryAction(ctx);
    case "recommend_review":
      return recommendReviewAction(ctx, ruleName, reason);
  }
}

async function notifyAction(
  spec: Extract<AutomationActionSpec, { kind: "notify" }>,
  ctx: AutomationContext,
  ruleName: string,
  reason: string,
) {
  const recipients = await resolveRecipients(spec.channel, ctx);
  if (recipients.size === 0) return { kind: "notify", ok: false, detail: "no recipients" };

  const groupKey = ctx.patientId ? `automation:${ctx.trigger}:${ctx.patientId}` : `automation:${ctx.trigger}`;
  for (const userId of recipients) {
    await createNotification({
      userId,
      organizationId: ctx.organizationId,
      type: "automation",
      priority: spec.priority as NotificationPriority,
      title: ruleName,
      body: reason,
      link: ctx.patientId ? `/patients/${ctx.patientId}` : null,
      groupKey,
      dedupeMinutes: 60,
      payload: {
        trigger: ctx.trigger,
        ...ctx.payload,
      },
    });
  }
  return { kind: "notify", ok: true, detail: `notified ${recipients.size}` };
}

async function escalateAction(
  spec: Extract<AutomationActionSpec, { kind: "escalate_status" }>,
  ctx: AutomationContext,
  ruleName: string,
  reason: string,
) {
  if (!ctx.patientId) return { kind: "escalate_status", ok: false, detail: "no patient" };
  const patient = await prisma.patient.findUnique({ where: { id: ctx.patientId } });
  if (!patient) return { kind: "escalate_status", ok: false, detail: "patient not found" };

  if (spec.onlySoft && !isSoft(patient.status)) {
    return { kind: "escalate_status", ok: false, detail: `status ${patient.status} not soft` };
  }
  if (patient.status === spec.to) {
    return { kind: "escalate_status", ok: false, detail: "already at target status" };
  }

  await prisma.patient.update({
    where: { id: ctx.patientId },
    data: { status: spec.to as WorkflowStatus },
  });
  await logAudit({
    action: "status_change",
    entityType: "patient",
    entityId: ctx.patientId,
    patientId: ctx.patientId,
    metadata: {
      from: patient.status,
      to: spec.to,
      auto: true,
      automation: ruleName,
      reason,
    },
  });
  events.emit("patient.status_changed", { patientId: ctx.patientId, status: spec.to });
  return { kind: "escalate_status", ok: true, detail: `${patient.status} -> ${spec.to}` };
}

async function refreshSummaryAction(ctx: AutomationContext) {
  if (!ctx.patientId) return { kind: "refresh_summary", ok: false, detail: "no patient" };
  const summary = await refreshPatientSummary(ctx.patientId, {
    reason: `automation:${ctx.trigger}`,
  });
  if (summary) events.emit("summary.refreshed", { patientId: ctx.patientId });
  return { kind: "refresh_summary", ok: !!summary };
}

async function recommendReviewAction(
  ctx: AutomationContext,
  _ruleName: string,
  reason: string,
) {
  if (!ctx.patientId) return { kind: "recommend_review", ok: false };
  await logAudit({
    action: "status_change",
    entityType: "patient",
    entityId: ctx.patientId,
    patientId: ctx.patientId,
    metadata: { auto: true, recommend: true, reason },
  });
  return { kind: "recommend_review", ok: true };
}

async function resolveRecipients(
  channel: "assignee" | "admins" | "requester",
  ctx: AutomationContext,
): Promise<Set<string>> {
  const ids = new Set<string>();
  if (channel === "assignee" && ctx.patientId) {
    const p = await prisma.patient.findUnique({
      where: { id: ctx.patientId },
      select: { assignedToId: true },
    });
    if (p?.assignedToId) ids.add(p.assignedToId);
  }
  if (channel === "requester") {
    const reqId = ctx.payload.requestedBy as string | undefined;
    if (reqId) ids.add(reqId);
  }
  if (channel === "admins") {
    const admins = await prisma.user.findMany({
      where: { organizationId: ctx.organizationId, role: "admin", archivedAt: null },
      select: { id: true },
    });
    for (const a of admins) ids.add(a.id);
  }
  return ids;
}

function isSoft(status: WorkflowStatus): boolean {
  return status === "new_patient" || status === "stable" || status === "monitoring";
}
