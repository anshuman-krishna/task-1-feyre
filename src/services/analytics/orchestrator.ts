import { log as logger } from "@/server/logger";
import { metrics as runtimeMetrics } from "@/server/metrics";
import { events } from "@/server/events";
import { captureDailySnapshot } from "./warehouse";
import { captureCohortSnapshots } from "./cohorts";
import { generateAllForecasts } from "./forecasting";
import { generateInsights, persistInsights } from "./insights";
import { recomputeAllTrajectories } from "./trajectory";

// the warehouse heartbeat. one call rolls the full analytical pipeline for
// an organization. callable on demand from admin, or wired to cron in the
// next pass. each step is independently retryable; errors don't cascade.

export type WarehouseRunResult = {
  organizationId: string;
  startedAt: Date;
  finishedAt: Date;
  durationMs: number;
  steps: {
    name: string;
    ok: boolean;
    durationMs: number;
    detail?: string;
  }[];
};

export async function runWarehouse(organizationId: string): Promise<WarehouseRunResult> {
  const startedAt = new Date();
  const steps: WarehouseRunResult["steps"] = [];

  await step("snapshot", () => captureDailySnapshot(organizationId));
  await step("cohorts", () => captureCohortSnapshots(organizationId));
  await step("trajectories", () => recomputeAllTrajectories(organizationId));
  await step("forecasts", () => generateAllForecasts(organizationId));
  await step("insights", async () => {
    const insights = await generateInsights(organizationId);
    return persistInsights(organizationId, insights);
  });

  const finishedAt = new Date();
  const durationMs = finishedAt.getTime() - startedAt.getTime();
  runtimeMetrics.observe("analytics_warehouse_run_ms", durationMs);
  logger.info("analytics.warehouse.run", {
    organizationId,
    durationMs,
    ok: steps.every((s) => s.ok),
  });
  events.emit("analytics.refreshed", { kind: "snapshot" });

  return { organizationId, startedAt, finishedAt, durationMs, steps };

  async function step(name: string, fn: () => Promise<unknown>) {
    const stepStart = Date.now();
    try {
      const r = await fn();
      steps.push({
        name,
        ok: true,
        durationMs: Date.now() - stepStart,
        detail: typeof r === "number" ? `${r} rows` : undefined,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      steps.push({ name, ok: false, durationMs: Date.now() - stepStart, detail: message });
      logger.error("analytics.warehouse.step_failed", { name, organizationId, error: message });
    }
  }
}
