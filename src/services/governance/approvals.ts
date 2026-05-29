import type { ApprovalKind, ApprovalState, Prisma } from "@prisma/client";
import { prisma } from "@/server/prisma";
import { metrics } from "@/server/metrics";
import { logAudit, type Actor } from "@/services/audit";

// approval workflow service. one row per (kind, target). transitioning a
// pending row writes the decider + audit. requesting a fresh approval on
// the same target after one has been decided creates a new row — keeps
// the trail linear and avoids overwriting history.

export type RequestApprovalInput = {
  organizationId: string;
  kind: ApprovalKind;
  targetType: string;
  targetId: string;
  patientId?: string | null;
  reason?: string;
  payload?: Prisma.InputJsonValue;
  actor?: Actor;
};

export async function requestApproval(input: RequestApprovalInput) {
  // suppress duplicate pending approvals on the same target
  const existing = await prisma.approval.findFirst({
    where: {
      organizationId: input.organizationId,
      kind: input.kind,
      targetType: input.targetType,
      targetId: input.targetId,
      state: "pending",
    },
  });
  if (existing) return existing;

  const row = await prisma.approval.create({
    data: {
      organizationId: input.organizationId,
      kind: input.kind,
      targetType: input.targetType,
      targetId: input.targetId,
      patientId: input.patientId ?? null,
      requestedById: input.actor?.id ?? null,
      requestedReason: input.reason ?? null,
      payload: input.payload,
    },
  });

  await logAudit({
    action: "approval_requested",
    entityType: "approval",
    entityId: row.id,
    patientId: input.patientId ?? null,
    actor: input.actor,
    metadata: { kind: input.kind, targetType: input.targetType, targetId: input.targetId },
  });

  metrics.inc("approvals_requested", { kind: input.kind });
  return row;
}

export type DecideApprovalInput = {
  approvalId: string;
  state: Extract<ApprovalState, "approved" | "rejected" | "withdrawn">;
  reason?: string;
  actor: Actor;
};

export async function decideApproval(input: DecideApprovalInput) {
  const existing = await prisma.approval.findUnique({ where: { id: input.approvalId } });
  if (!existing) throw new Error("approval not found");
  if (existing.state !== "pending") return existing;

  const row = await prisma.approval.update({
    where: { id: input.approvalId },
    data: {
      state: input.state,
      decidedById: input.actor?.id ?? null,
      decidedAt: new Date(),
      decisionReason: input.reason ?? null,
    },
  });

  await logAudit({
    action: "approval_decided",
    entityType: "approval",
    entityId: row.id,
    patientId: row.patientId,
    actor: input.actor,
    metadata: {
      kind: row.kind,
      decision: input.state,
      targetType: row.targetType,
      targetId: row.targetId,
    },
  });

  metrics.inc("approvals_decided", { kind: row.kind, state: input.state });
  return row;
}

export async function listApprovals(
  organizationId: string,
  filter: { state?: ApprovalState; kind?: ApprovalKind; limit?: number } = {},
) {
  return prisma.approval.findMany({
    where: {
      organizationId,
      state: filter.state,
      kind: filter.kind,
    },
    orderBy: [{ state: "asc" }, { createdAt: "desc" }],
    take: filter.limit ?? 50,
    include: {
      requestedBy: { select: { name: true } },
      decidedBy: { select: { name: true } },
      patient: { select: { id: true, fullName: true } },
    },
  });
}

export async function approvalsForTarget(targetType: string, targetId: string) {
  return prisma.approval.findMany({
    where: { targetType, targetId },
    orderBy: { createdAt: "desc" },
  });
}
