import { ok } from "@/lib/api-response";
import { withErrorHandling } from "@/server/handler";
import {
  biomarkerAverages,
  dashboardSummary,
  patientGrowth,
  predictionThroughput,
  riskDistribution,
} from "@/services/analytics";

export const dynamic = "force-dynamic";

export const GET = withErrorHandling(async () => {
  const [summary, distribution, throughput, growth, averages] = await Promise.all([
    dashboardSummary(),
    riskDistribution(),
    predictionThroughput(),
    patientGrowth(),
    biomarkerAverages(),
  ]);
  return ok({ summary, distribution, throughput, growth, averages });
});
