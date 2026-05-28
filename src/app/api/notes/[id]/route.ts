import type { NextRequest } from "next/server";
import { ok } from "@/lib/api-response";
import { withErrorHandling } from "@/server/handler";
import { deleteNote } from "@/services/note";

type Ctx = { params: Promise<{ id: string }> };

export const DELETE = withErrorHandling(async (_req: NextRequest, ctx: Ctx) => {
  const { id } = await ctx.params;
  const result = await deleteNote(id);
  return ok(result);
});
