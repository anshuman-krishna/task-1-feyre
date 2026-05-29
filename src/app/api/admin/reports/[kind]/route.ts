import type { NextRequest } from "next/server";
import { withErrorHandling } from "@/server/handler";
import { BadRequest } from "@/lib/api-error";
import { requireAdmin } from "@/server/admin";
import {
  aiUsageCsv,
  governanceReport,
  reliabilityCsv,
  toCsv,
} from "@/services/governance/reports";
import { logAudit } from "@/services/audit";

type Ctx = { params: Promise<{ kind: string }> };

export const GET = withErrorHandling(async (_req: NextRequest, ctx: Ctx) => {
  const user = await requireAdmin();
  const { kind } = await ctx.params;

  let csv: string;
  if (kind === "governance") csv = toCsv(await governanceReport(user.organizationId));
  else if (kind === "ai-usage") csv = toCsv(await aiUsageCsv(user.organizationId));
  else if (kind === "reliability") csv = toCsv(await reliabilityCsv());
  else throw BadRequest("unknown report kind");

  await logAudit({
    action: "export",
    entityType: "report",
    entityId: kind,
    actor: { id: user.id, name: user.name, organizationId: user.organizationId },
    metadata: { format: "csv" },
  });

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${kind}-${Date.now()}.csv"`,
    },
  });
});
