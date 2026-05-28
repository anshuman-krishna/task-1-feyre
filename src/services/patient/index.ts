import type { Prisma } from "@prisma/client";
import { prisma } from "@/server/prisma";
import { NotFound, Conflict } from "@/lib/api-error";
import { logAudit } from "@/services/audit";
import { executePrediction, hasBiomarkers } from "@/services/prediction";
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
    }),
    prisma.patient.count({ where }),
  ]);

  return { rows, total, page: q.page, pageSize: q.pageSize };
}

export async function getPatient(id: string) {
  const patient = await prisma.patient.findUnique({ where: { id } });
  if (!patient || patient.archivedAt) throw NotFound("patient");
  return patient;
}

export async function createPatient(input: PatientCreateInput, performedBy?: string) {
  const existing = await prisma.patient.findUnique({ where: { email: input.email } });
  if (existing) throw Conflict("a patient with this email already exists");

  const patient = await prisma.patient.create({
    data: {
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
    },
  });

  await logAudit({
    action: "create",
    entityType: "patient",
    entityId: patient.id,
    patientId: patient.id,
    performedBy,
    metadata: { fullName: patient.fullName },
  });

  // run prediction inline if biomarkers were provided. errors are absorbed
  // by executePrediction so the create still succeeds.
  if (hasBiomarkers(patient)) {
    await executePrediction(patient.id, { performedBy });
  }

  return prisma.patient.findUnique({ where: { id: patient.id } });
}

export async function updatePatient(
  id: string,
  input: PatientUpdateInput,
  performedBy?: string,
) {
  const previous = await getPatient(id);

  const patient = await prisma.patient.update({
    where: { id },
    data: {
      ...input,
      dob: input.dob ? new Date(input.dob) : undefined,
    },
  });

  await logAudit({
    action: "update",
    entityType: "patient",
    entityId: id,
    patientId: id,
    performedBy,
    metadata: { fields: Object.keys(input) },
  });

  const biomarkersChanged = BIOMARKER_FIELDS.some(
    (f) => input[f] !== undefined && input[f] !== previous[f],
  );
  if (biomarkersChanged && hasBiomarkers(patient)) {
    await executePrediction(id, { performedBy });
  }

  return prisma.patient.findUnique({ where: { id } });
}

export async function archivePatient(id: string, performedBy?: string) {
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
    performedBy,
  });
  return patient;
}
