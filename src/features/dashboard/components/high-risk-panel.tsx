import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { RiskBadge } from "@/components/risk-badge";
import { EmptyState } from "@/components/empty-state";
import { ageFromDob, relativeTime } from "@/lib/format";
import { prisma } from "@/server/prisma";

export async function HighRiskPanel() {
  const rows = await prisma.patient.findMany({
    where: { archivedAt: null, riskLevel: { in: ["elevated", "critical"] } },
    orderBy: [{ riskLevel: "desc" }, { lastPredictedAt: "desc" }],
    take: 5,
  });

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <div className="space-y-1">
          <CardTitle>High-risk caseload</CardTitle>
          <CardDescription>Patients flagged by the prediction engine.</CardDescription>
        </div>
        <Link
          href="/patients?risk=elevated"
          className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          View all <ArrowUpRight className="h-3 w-3" />
        </Link>
      </CardHeader>
      <CardContent className="space-y-1">
        {rows.length === 0 ? (
          <EmptyState
            title="No high-risk patients"
            description="The prediction engine hasn't surfaced any elevated or critical signals."
          />
        ) : (
          rows.map((row) => (
            <Link
              key={row.id}
              href={`/patients/${row.id}`}
              className="-mx-2 flex items-center justify-between rounded-md px-2 py-2 transition-colors hover:bg-muted/60"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">{row.fullName}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {ageFromDob(row.dob)} · {row.aiPrediction ?? "no observation"}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                {row.predictionConfidence != null && (
                  <span className="font-mono text-xs text-muted-foreground">
                    {(row.predictionConfidence * 100).toFixed(0)}%
                  </span>
                )}
                <RiskBadge level={row.riskLevel} />
                {row.lastPredictedAt && (
                  <span className="hidden text-[11px] text-muted-foreground md:inline">
                    {relativeTime(row.lastPredictedAt)}
                  </span>
                )}
              </div>
            </Link>
          ))
        )}
      </CardContent>
    </Card>
  );
}
