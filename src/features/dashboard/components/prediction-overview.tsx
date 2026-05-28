import { predictionThroughput } from "@/services/analytics";
import { ThroughputChart } from "@/features/analytics/components/throughput-chart";

export async function PredictionOverview() {
  const data = await predictionThroughput(14);
  return <ThroughputChart data={data} />;
}
