import type { Prisma } from "@prisma/client";
import { prisma } from "@/server/prisma";
import { NotFound, Conflict } from "@/lib/api-error";
import { logAudit, type Actor } from "@/services/audit";
import { hasBiomarkers } from "@/services/prediction";
import { enqueuePrediction } from "@/services/queue/prediction";
import { tenantOf } from "@/services/tenant";
import type {
  PatientCreateInput,
  PatientUpdateInput,
  PatientQuery,
} from "@/features/patients/schema";

const BIOMARKER_FIELDS = [
  "glucose",
  "haemoglobin",
  "cholesterol",
  "systolic",
  "diastolic",
  "bmi",
] as const;

export async function listPatients(q: PatientQuery) {
  const where: Prisma.PatientWhereInput = {
    archivedAt: q.includeArchived ? undefined : null,
    riskLevel: q.risk,
    status: q.status,
    assignedToId: q.assignedTo,
    ...(q.followUpDue ? { followUpAt: { lte: new Date() } } : {}),
    ...(q.q
      ? {
          OR: [
            { fullName: { contains: q.q, mode: "insensitive" } },
            { email: { contains: q.q, mode: "insensitive" } },
            { aiPrediction: { contains: q.q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.patient.findMany({
      where,
      orderBy: { [q.sort]: q.order },
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
      include: { assignedTo: { select: { id: true, name: true, avatarHue: true } } },
    }),
    prisma.patient.count({ where }),
  ]);

  return { rows, total, page: q.page, pageSize: q.pageSize };
}

export async function getPatient(id: string) {
  const patient = await prisma.patient.findUnique({
    where: { id },
    include: { assignedTo: true },
  });
  if (!patient || patient.archivedAt) throw NotFound("patient");
  return patient;
}

export async function createPatient(input: PatientCreateInput, actor?: Actor) {
  const organizationId = tenantOf(actor);
  const existing = await prisma.patient.findUnique({
    where: { organizationId_email: { organizationId, email: input.email } },
  });
  if (existing) throw Conflict("a patient with this email already exists");

  const patient = await prisma.patient.create({
    data: {
      organizationId,
      fullName: input.fullName,
      email: input.email,
      dob: new Date(input.dob),
      sex: input.sex,
      glucose: input.glucose ?? null,
      haemoglobin: input.haemoglobin ?? null,
      cholesterol: input.cholesterol ?? null,
      systolic: input.systolic ?? null,
      diastolic: input.diastolic ?? null,
      bmi: input.bmi ?? null,
      assignedToId: input.assignedToId ?? actor?.id ?? null,
    },
  });

  await logAudit({
    action: "create",
    entityType: "patient",
    entityId: patient.id,
    patientId: patient.id,
    actor,
    metadata: { fullName: patient.fullName },
  });

  if (hasBiomarkers(patient)) {
    await enqueuePrediction(patient.id, { actor });
  }

  return prisma.patient.findUnique({
    where: { id: patient.id },
    include: { assignedTo: true },
  });
}

export async function updatePatient(id: string, input: PatientUpdateInput, actor?: Actor) {
  const previous = await getPatient(id);

  const statusChanged = input.status !== undefined && input.status !== previous.status;
  const assigneeChanged =
    input.assignedToId !== undefined && input.assignedToId !== previous.assignedToId;
  const consentChanged =
    (input.consentResearch !== undefined && input.consentResearch !== previous.consentResearch) ||
    (input.consentDataSharing !== undefined &&
      input.consentDataSharing !== previous.consentDataSharing);
  const retentionChanged =
    input.retentionUntil !== undefined &&
    String(input.retentionUntil ?? null) !==
      String(previous.retentionUntil ? previous.retentionUntil.toISOString() : null);

  const { followUpAt, retentionUntil, ...rest } = input;
  await prisma.patient.update({
    where: { id },
    data: {
      ...rest,
      dob: input.dob ? new Date(input.dob) : undefined,
      followUpAt:
        followUpAt === undefined ? undefined : followUpAt === null ? null : new Date(followUpAt),
      retentionUntil:
        retentionUntil === undefined
          ? undefined
          : retentionUntil === null
            ? null
            : new Date(retentionUntil),
      reviewedAt: statusChanged || assigneeChanged ? new Date() : undefined,
    },
  });

  await logAudit({
    action: "update",
    entityType: "patient",
    entityId: id,
    patientId: id,
    actor,
    metadata: { fields: Object.keys(input) },
  });

  if (statusChanged && input.status) {
    await logAudit({
      action: "status_change",
      entityType: "patient",
      entityId: id,
      patientId: id,
      actor,
      metadata: { from: previous.status, to: input.status },
    });
  }

  if (assigneeChanged) {
    await logAudit({
      action: "assign",
      entityType: "patient",
      entityId: id,
      patientId: id,
      actor,
      metadata: { from: previous.assignedToId, to: input.assignedToId },
    });
  }

  if (consentChanged) {
    await logAudit({
      action: "consent_change",
      entityType: "patient",
      entityId: id,
      patientId: id,
      actor,
      metadata: {
        research:
          input.consentResearch !== undefined
            ? { from: previous.consentResearch, to: input.consentResearch }
            : undefined,
        dataSharing:
          input.consentDataSharing !== undefined
            ? { from: previous.consentDataSharing, to: input.consentDataSharing }
            : undefined,
      },
    });
  }

  if (retentionChanged) {
    await logAudit({
      action: "retention_change",
      entityType: "patient",
      entityId: id,
      patientId: id,
      actor,
      metadata: {
        from: previous.retentionUntil,
        to: input.retentionUntil,
      },
    });
  }

  const biomarkersChanged = BIOMARKER_FIELDS.some(
    (f) => input[f] !== undefined && input[f] !== previous[f],
  );
  const fresh = await prisma.patient.findUnique({ where: { id }, include: { assignedTo: true } });
  if (biomarkersChanged && fresh && hasBiomarkers(fresh)) {
    await enqueuePrediction(id, { actor });
  }

  return prisma.patient.findUnique({
    where: { id },
    include: { assignedTo: true },
  });
}

export async function archivePatient(id: string, actor?: Actor) {
  await getPatient(id);
  const patient = await prisma.patient.update({
    where: { id },
    data: { archivedAt: new Date() },
  });
  await logAudit({
    action: "archive",
    entityType: "patient",
    entityId: id,
    patientId: id,
    actor,
  });
  return patient;
}

