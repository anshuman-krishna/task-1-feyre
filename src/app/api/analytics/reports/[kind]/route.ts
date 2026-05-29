import type { NextRequest } from "next/server";
import type { ReportKind } from "@prisma/client";
import { withErrorHandling } from "@/server/handler";
import { BadRequest } from "@/lib/api-error";
import { requireAdmin } from "@/server/admin";
import { runReport, REPORTS } from "@/services/analytics";
import { toCsv } from "@/services/governance/reports";
import { logAudit } from "@/services/audit";

type Ctx = { params: Promise<{ kind: string }> };

export const GET = withErrorHandling(async (_req: NextRequest, ctx: Ctx) => {
  const user = await requireAdmin();
  const { kind } = await ctx.params;
  if (!(kind in REPORTS)) throw BadRequest("unknown report kind");

  const result = await runReport(user.organizationId, kind as ReportKind);
  await logAudit({
    action: "export",
    entityType: "analytics_report",
    entityId: kind,
    actor: { id: user.id, name: user.name, organizationId: user.organizationId },
    metadata: { format: "csv" },
  });

  return new Response(toCsv(result.csv), {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${kind}-${Date.now()}.csv"`,
    },
  });
});
