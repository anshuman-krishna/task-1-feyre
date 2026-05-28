import type { NextRequest } from "next/server";
import { ok } from "@/lib/api-response";
import { withErrorHandling } from "@/server/handler";
import { NoteCreateSchema } from "@/features/patients/schema";
import { createNote, listNotes } from "@/services/note";
import { getCurrentUser } from "@/server/session";

type Ctx = { params: Promise<{ id: string }> };

export const GET = withErrorHandling(async (_req: NextRequest, ctx: Ctx) => {
  const { id } = await ctx.params;
  const notes = await listNotes(id);
  return ok(notes);
});

export const POST = withErrorHandling(async (req: NextRequest, ctx: Ctx) => {
  const { id } = await ctx.params;
  const user = await getCurrentUser();
  const body = await req.json();
  const input = NoteCreateSchema.parse(body);
  const note = await createNote(id, input, user ? { id: user.id, name: user.name } : null);
  return ok(note, { status: 201 });
});
