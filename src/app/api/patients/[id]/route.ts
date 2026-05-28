import type { NextRequest } from "next/server";
import { ok } from "@/lib/api-response";
import { withErrorHandling } from "@/server/handler";
import { PatientUpdateSchema } from "@/features/patients/schema";
import { archivePatient, getPatient, updatePatient } from "@/services/patient";
import { getCurrentUser } from "@/server/session";

type Ctx = { params: Promise<{ id: string }> };

export const GET = withErrorHandling(async (_req: NextRequest, ctx: Ctx) => {
  const { id } = await ctx.params;
  const patient = await getPatient(id);
  return ok(patient);
});

export const PATCH = withErrorHandling(async (req: NextRequest, ctx: Ctx) => {
  const { id } = await ctx.params;
  const body = await req.json();
  const input = PatientUpdateSchema.parse(body);
  const user = await getCurrentUser();
  const patient = await updatePatient(id, input, user ? { id: user.id, name: user.name } : null);
  return ok(patient);
});

export const DELETE = withErrorHandling(async (_req: NextRequest, ctx: Ctx) => {
  const { id } = await ctx.params;
  const user = await getCurrentUser();
  const patient = await archivePatient(id, user ? { id: user.id, name: user.name } : null);
  return ok(patient);
});
