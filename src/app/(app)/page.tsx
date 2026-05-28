import Link from "next/link";
import { CalendarClock, Heart, ShieldAlert, Sparkles, Users } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { MetricCard } from "@/components/metric-card";
import { Button } from "@/components/ui/button";
import { HighRiskPanel } from "@/features/dashboard/components/high-risk-panel";
import { PredictionOverview } from "@/features/dashboard/components/prediction-overview";
import { AlertsPanel } from "@/features/dashboard/components/alerts-panel";
import { ActivityFeed } from "@/features/activity/components/activity-feed";
import { dashboardSummary } from "@/services/analytics";
import { listActivity } from "@/services/activity";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [summary, activity] = await Promise.all([dashboardSummary(), listActivity(8)]);

  const activityEntries = activity.map((a) => ({ ...a, createdAt: a.createdAt.toISOString() }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Operational overview"
        description="What's happening across the clinic, summarised by the intelligence layer."
        actions={
          <>
            <Button asChild variant="outline" size="sm">
              <a href="/api/patients/export">Export CSV</a>
            </Button>
            <Button asChild size="sm">
              <Link href="/patients/new">New patient</Link>
            </Button>
          </>
        }
      />

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <MetricCard
          label="Active patients"
          value={summary.activePatients}
          delta={`+${summary.trends.patients30d}`}
          trend={summary.trends.patients30d > 0 ? "up" : "flat"}
          hint="last 30 days"
          icon={<Users className="h-4 w-4" />}
          accent
        />
        <MetricCard
          label="Predictions / 24h"
          value={summary.predictionsLast24h}
          delta={fmtDelta(summary.trends.predictions24hDelta)}
          trend={trend(summary.trends.predictions24hDelta)}
          hint="vs prior 24h"
          icon={<Sparkles className="h-4 w-4" />}
        />
        <MetricCard
          label="High-risk caseload"
          value={summary.highRiskCount}
          delta={fmtDelta(summary.trends.highRisk7dDelta)}
          trend={trend(summary.trends.highRisk7dDelta)}
          hint="elevated + critical"
          icon={<ShieldAlert className="h-4 w-4" />}
        />
        <MetricCard
          label="Follow-ups due"
          value={summary.followUpBacklog}
          hint="overdue today"
          icon={<CalendarClock className="h-4 w-4" />}
        />
        <MetricCard
          label="Avg. confidence"
          value={summary.avgConfidence ? `${(summary.avgConfidence * 100).toFixed(0)}%` : "—"}
          hint="across active patients"
          icon={<Heart className="h-4 w-4" />}
        />
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <PredictionOverview />
          <HighRiskPanel />
        </div>
        <div className="space-y-4">
          <AlertsPanel />
          <ActivityFeed entries={activityEntries} />
        </div>
      </section>

      <p className="rounded-md border border-dashed border-border bg-muted/40 px-4 py-3 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">Note: </span>
        AI-generated observations are risk signals, not medical diagnoses. Consult a qualified
        clinician for clinical decisions.
      </p>
    </div>
  );
}

function fmtDelta(n: number) {
  if (n === 0) return "no change";
  return n > 0 ? `+${n}` : String(n);
}

function trend(n: number): "up" | "down" | "flat" {
  if (n > 0) return "up";
  if (n < 0) return "down";
  return "flat";
}
