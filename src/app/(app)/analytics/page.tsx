import {
  Activity,
  CalendarClock,
  Heart,
  ShieldAlert,
  Sparkles,
  UsersRound,
} from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { MetricCard } from "@/components/metric-card";
import { getCurrentUser } from "@/server/session";
import {
  biomarkerAverages,
  dashboardSummary,
  intakeVelocity,
  patientGrowth,
  predictionThroughput,
  riskDistribution,
  statusDistribution,
} from "@/services/analytics";
import {
  aiEffectiveness,
  automationHealth,
  clinicianMetrics,
  COHORTS,
  latestCohorts,
  latestForecasts,
  recentInsights,
  trajectoriesByDirection,
  trajectoryDistribution,
} from "@/services/analytics";
import { RiskDistributionChart } from "@/features/analytics/components/risk-distribution-chart";
import { StatusDistribution } from "@/features/analytics/components/status-distribution";
import { ThroughputChart } from "@/features/analytics/components/throughput-chart";
import { GrowthChart } from "@/features/analytics/components/growth-chart";
import { BiomarkerAverages } from "@/features/analytics/components/biomarker-averages";
import { CohortGrid } from "@/features/analytics/components/cohort-grid";
import { ForecastChart } from "@/features/analytics/components/forecast-chart";
import { InsightFeed } from "@/features/analytics/components/insight-feed";
import { TrajectoryOverview } from "@/features/analytics/components/trajectory-overview";
import { ClinicianLoad } from "@/features/analytics/components/clinician-load";
import { AIEffectivenessPanel } from "@/features/analytics/components/ai-effectiveness";
import { AutomationHealthPanel } from "@/features/analytics/components/automation-health";

export const metadata = { title: "Analytics" };
export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  const orgId = user.organizationId;

  const [
    summary,
    distribution,
    status,
    throughput,
    growth,
    averages,
    velocity,
    cohorts,
    forecasts,
    insights,
    trajDist,
    deteriorating,
    clinicians,
    aiE,
    autoHealth,
  ] = await Promise.all([
    dashboardSummary(),
    riskDistribution(),
    statusDistribution(),
    predictionThroughput(),
    patientGrowth(),
    biomarkerAverages(),
    intakeVelocity(),
    latestCohorts(orgId),
    latestForecasts(orgId),
    recentInsights(orgId),
    trajectoryDistribution(orgId),
    trajectoriesByDirection(orgId, "deteriorating", 6),
    clinicianMetrics(orgId),
    aiEffectiveness(orgId),
    automationHealth(orgId),
  ]);

  const distData = (["low", "moderate", "elevated", "critical", "unassessed"] as const).map(
    (level) => ({ level, count: distribution[level] ?? 0 }),
  );

  const cohortRows = cohorts.map((c) => ({
    kind: c.kind,
    label: c.def.label,
    description: c.def.description,
    size: c.latest?.size ?? 0,
    delta: c.latest?.delta ?? 0,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Operational intelligence"
        description="Cohorts, trajectories, forecasts, and AI quality — every metric tied to a decision."
      />

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <MetricCard
          label="Active patients"
          value={summary.activePatients}
          icon={<UsersRound className="h-4 w-4" />}
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
          label="Follow-up backlog"
          value={summary.followUpBacklog}
          hint="due today"
          icon={<CalendarClock className="h-4 w-4" />}
        />
        <MetricCard
          label="Intake velocity"
          value={velocity.last7d}
          delta={fmtDelta(velocity.delta)}
          trend={trend(velocity.delta)}
          hint="patients / 7d"
          icon={<Heart className="h-4 w-4" />}
        />
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <InsightFeed insights={insights.map((i) => ({
          id: i.id,
          category: i.category,
          severity: i.severity,
          headline: i.headline,
          detail: i.detail,
          createdAt: i.createdAt,
        }))} />
        <TrajectoryOverview
          distribution={trajDist}
          deteriorating={deteriorating.map((d) => ({
            patientId: d.patientId,
            patient: {
              id: d.patient.id,
              fullName: d.patient.fullName,
              riskLevel: d.patient.riskLevel,
            },
            score: d.score,
            confidence: d.confidence,
          }))}
        />
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <CohortGrid
          cohorts={
            cohortRows.length > 0
              ? cohortRows
              : (Object.values(COHORTS) as { kind: string; label: string; description: string }[]).map((d) => ({
                  kind: d.kind,
                  label: d.label,
                  description: d.description,
                  size: 0,
                  delta: 0,
                }))
          }
        />
        <ClinicianLoad metrics={clinicians} />
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <AIEffectivenessPanel data={aiE} />
        <AutomationHealthPanel data={autoHealth} />
      </section>

      <section>
        <div className="mb-2 flex items-center gap-2">
          <Activity className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold text-foreground">Forecasts</h2>
          <p className="text-xs text-muted-foreground">
            Projected ranges over the next two weeks. Planning aid, not certainty.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {forecasts
            .filter((f) => f.payload)
            .map((f) => (
              <ForecastChart key={f.metric} payload={f.payload!} />
            ))}
          {forecasts.every((f) => !f.payload) ? (
            <p className="text-xs text-muted-foreground">
              No forecasts generated yet. Run the warehouse from Admin → Warehouse to seed them.
            </p>
          ) : null}
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <StatusDistribution data={status} />
        <RiskDistributionChart data={distData} />
        <ThroughputChart data={throughput} />
        <GrowthChart data={growth} />
        <BiomarkerAverages averages={averages as Record<string, number | null>} />
      </section>
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
