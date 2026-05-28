import type { NextRequest } from "next/server";
import { ok } from "@/lib/api-response";
import { withErrorHandling } from "@/server/handler";
import { PatientCreateSchema, PatientQuerySchema } from "@/features/patients/schema";
import { createPatient, listPatients } from "@/services/patient";

export const GET = withErrorHandling(async (req: NextRequest) => {
  const params = Object.fromEntries(req.nextUrl.searchParams.entries());
  const query = PatientQuerySchema.parse(params);
  const result = await listPatients(query);
  return ok(result);
});

export const POST = withErrorHandling(async (req: NextRequest) => {
  const body = await req.json();
  const input = PatientCreateSchema.parse(body);
  const patient = await createPatient(input);
  return ok(patient, { status: 201 });
});
