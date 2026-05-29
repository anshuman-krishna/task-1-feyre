import { prisma } from "@/server/prisma";
import { aiUsageReport } from "./lineage";

// CSV-shaped governance reports. each function returns a header row plus
// data rows so the API route can stream the result without buffering JSON
// in memory. content is intentionally minimal — operations teams prefer
// dense, copy-into-sheets formats.

export type CsvReport = { header: string[]; rows: (string | number | null)[][] };

export async function governanceReport(
  organizationId: string,
  since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
): Promise<CsvReport> {
  const [rules, fires, approvals] = await Promise.all([
    prisma.automationRule.findMany({ where: { organizationId } }),
    prisma.automationEvent.groupBy({
      by: ["ruleKey"],
      where: { organizationId, createdAt: { gte: since } },
      _count: { _all: true },
    }),
    prisma.approval.groupBy({
      by: ["kind", "state"],
      where: { organizationId, createdAt: { gte: since } },
      _count: { _all: true },
    }),
  ]);
  const fireMap: Record<string, number> = {};
  for (const f of fires) fireMap[f.ruleKey] = f._count._all;

  const header = ["kind", "key", "name/state", "enabled", "fires_30d", "count_30d"];
  const rows: CsvReport["rows"] = [];
  for (const r of rules) {
    rows.push([
      "automation_rule",
      r.key,
      r.name,
      r.enabled ? "true" : "false",
      fireMap[r.key] ?? 0,
      null,
    ]);
  }
  for (const a of approvals) {
    rows.push(["approval", a.kind, a.state, null, null, a._count._all]);
  }
  return { header, rows };
}

export async function aiUsageCsv(organizationId: string): Promise<CsvReport> {
  const usage = await aiUsageReport(organizationId);
  const header = ["task", "provider", "runs", "avg_latency_ms", "avg_confidence", "total_latency_ms"];
  const rows: CsvReport["rows"] = usage.map((u) => [
    u.task,
    u.provider,
    u._count._all,
    Math.round(u._avg.latencyMs ?? 0),
    u._avg.confidence != null ? Number(u._avg.confidence.toFixed(3)) : null,
    u._sum.latencyMs ?? 0,
  ]);
  return { header, rows };
}

export async function reliabilityCsv(): Promise<CsvReport> {
  const grouped = await prisma.predictionJob.groupBy({
    by: ["status"],
    _count: { _all: true },
  });
  const header = ["metric", "kind", "value"];
  const rows: CsvReport["rows"] = grouped.map((g) => ["queue", g.status, g._count._all]);
  return { header, rows };
}

export function toCsv(report: CsvReport): string {
  const escape = (v: string | number | null) => {
    if (v == null) return "";
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [report.header.map(escape).join(",")];
  for (const r of report.rows) lines.push(r.map(escape).join(","));
  return lines.join("\n");
}
