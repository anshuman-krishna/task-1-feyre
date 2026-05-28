import { z } from "zod";

export const RiskLevelSchema = z.enum(["low", "moderate", "elevated", "critical"]);

const optionalNumber = z
  .union([z.number(), z.string()])
  .transform((v) => (v === "" || v == null ? null : Number(v)))
  .refine((v) => v === null || Number.isFinite(v), { message: "not a valid number" });

export const PatientCreateSchema = z.object({
  fullName: z.string().trim().min(2, "name is too short").max(120),
  email: z.string().trim().toLowerCase().email("invalid email"),
  dob: z.string().refine((s) => !Number.isNaN(Date.parse(s)), "invalid date"),
  sex: z.enum(["male", "female", "other"]).optional().nullable(),

  glucose: optionalNumber.optional().nullable(),
  haemoglobin: optionalNumber.optional().nullable(),
  cholesterol: optionalNumber.optional().nullable(),
  systolic: optionalNumber.optional().nullable(),
  diastolic: optionalNumber.optional().nullable(),
  bmi: optionalNumber.optional().nullable(),
});

export const PatientUpdateSchema = PatientCreateSchema.partial();

export const PatientQuerySchema = z.object({
  q: z.string().trim().optional(),
  risk: RiskLevelSchema.optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.enum(["createdAt", "fullName", "lastPredictedAt"]).default("createdAt"),
  order: z.enum(["asc", "desc"]).default("desc"),
  includeArchived: z.coerce.boolean().default(false),
});

export const NoteCreateSchema = z.object({
  body: z.string().trim().min(1, "note cannot be empty").max(2000),
  author: z.string().trim().max(120).optional(),
});

export type PatientCreateInput = z.infer<typeof PatientCreateSchema>;
export type PatientUpdateInput = z.infer<typeof PatientUpdateSchema>;
export type PatientQuery = z.infer<typeof PatientQuerySchema>;
export type NoteCreateInput = z.infer<typeof NoteCreateSchema>;
