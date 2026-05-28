import type { NextRequest } from "next/server";
import { withErrorHandling } from "@/server/handler";
import { patientReportMarkdown } from "@/services/export";
import { getCurrentUser } from "@/server/session";

type Ctx = { params: Promise<{ id: string }> };

export const GET = withErrorHandling(async (_req: NextRequest, ctx: Ctx) => {
  const { id } = await ctx.params;
  const user = await getCurrentUser();
  const body = await patientReportMarkdown(id, user ? { id: user.id, name: user.name, organizationId: user.organizationId } : null);
  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="patient-${id}.md"`,
    },
  });
});
