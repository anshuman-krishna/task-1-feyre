import { prisma } from "@/server/prisma";
import { NotFound } from "@/lib/api-error";
import { logAudit, type Actor } from "@/services/audit";
import type { NoteCreateInput } from "@/features/patients/schema";

export async function listNotes(patientId: string) {
  return prisma.note.findMany({
    where: { patientId },
    orderBy: { createdAt: "desc" },
  });
}

export async function createNote(patientId: string, input: NoteCreateInput, actor?: Actor) {
  const patient = await prisma.patient.findUnique({ where: { id: patientId } });
  if (!patient) throw NotFound("patient");

  const note = await prisma.note.create({
    data: {
      patientId,
      body: input.body,
      author: input.author ?? actor?.name ?? "clinician",
    },
  });

  await logAudit({
    action: "note_add",
    entityType: "note",
    entityId: note.id,
    patientId,
    actor,
    metadata: { preview: input.body.slice(0, 80) },
  });

  return note;
}

export async function deleteNote(noteId: string, actor?: Actor) {
  const note = await prisma.note.findUnique({ where: { id: noteId } });
  if (!note) throw NotFound("note");

  await prisma.note.delete({ where: { id: noteId } });

  await logAudit({
    action: "note_remove",
    entityType: "note",
    entityId: noteId,
    patientId: note.patientId,
    actor,
  });

  return { id: noteId };
}
