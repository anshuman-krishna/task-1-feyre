import { prisma } from "@/server/prisma";
import { NotFound } from "@/lib/api-error";
import { logAudit } from "@/services/audit";
import type { NoteCreateInput } from "@/features/patients/schema";

export async function listNotes(patientId: string) {
  return prisma.note.findMany({
    where: { patientId },
    orderBy: { createdAt: "desc" },
  });
}

export async function createNote(patientId: string, input: NoteCreateInput, performedBy?: string) {
  const patient = await prisma.patient.findUnique({ where: { id: patientId } });
  if (!patient) throw NotFound("patient");

  const note = await prisma.note.create({
    data: {
      patientId,
      body: input.body,
      author: input.author ?? performedBy ?? "clinician",
    },
  });

  await logAudit({
    action: "note_add",
    entityType: "note",
    entityId: note.id,
    patientId,
    performedBy,
    metadata: { preview: input.body.slice(0, 80) },
  });

  return note;
}

export async function deleteNote(noteId: string, performedBy?: string) {
  const note = await prisma.note.findUnique({ where: { id: noteId } });
  if (!note) throw NotFound("note");

  await prisma.note.delete({ where: { id: noteId } });

  await logAudit({
    action: "note_remove",
    entityType: "note",
    entityId: noteId,
    patientId: note.patientId,
    performedBy,
  });

  return { id: noteId };
}
