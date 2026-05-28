import { PageHeader } from "@/components/layout/page-header";
import {
  biomarkerAverages,
  dashboardSummary,
  patientGrowth,
  predictionThroughput,
  riskDistribution,
} from "@/services/analytics";
import { MetricCard } from "@/components/metric-card";
import { Heart, ShieldAlert, Sparkles, Users } from "lucide-react";
import { RiskDistributionChart } from "@/features/analytics/components/risk-distribution-chart";
import { ThroughputChart } from "@/features/analytics/components/throughput-chart";
import { GrowthChart } from "@/features/analytics/components/growth-chart";
import { BiomarkerAverages } from "@/features/analytics/components/biomarker-averages";

export const metadata = { title: "Analytics" };
export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  const [summary, distribution, throughput, growth, averages] = await Promise.all([
    dashboardSummary(),
    riskDistribution(),
    predictionThroughput(),
    patientGrowth(),
    biomarkerAverages(),
  ]);

  const distData = (["low", "moderate", "elevated", "critical", "unassessed"] as const).map(
    (level) => ({ level, count: distribution[level] ?? 0 }),
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Analytics"
        description="Cohort risk distribution, prediction throughput, and biomarker trends."
      />

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Active patients"
          value={summary.activePatients}
          hint="archived excluded"
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
          label="High-risk patients"
          value={summary.highRiskCount}
          delta={fmtDelta(summary.trends.highRisk7dDelta)}
          trend={trend(summary.trends.highRisk7dDelta)}
          hint="elevated + critical"
          icon={<ShieldAlert className="h-4 w-4" />}
        />
        <MetricCard
          label="Avg. confidence"
          value={summary.avgConfidence ? `${(summary.avgConfidence * 100).toFixed(0)}%` : "—"}
          hint="across active patients"
          icon={<Heart className="h-4 w-4" />}
        />
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
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
