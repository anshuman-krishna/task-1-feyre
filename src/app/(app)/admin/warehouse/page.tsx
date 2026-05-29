import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser } from "@/server/session";
import {
  recentSnapshots,
  latestSnapshot,
  metricList,
  pickMetric,
  recentInsights,
  latestForecasts,
} from "@/services/analytics";
import { WarehouseClient } from "@/features/admin/components/warehouse-client";
import { formatDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AdminWarehousePage() {
  const user = await getCurrentUser();
  if (!user) return null;
  const orgId = user.organizationId;

  const [latest, snapshots, insights, forecasts] = await Promise.all([
    latestSnapshot(orgId),
    recentSnapshots(orgId, 14),
    recentInsights(orgId, 14),
    latestForecasts(orgId),
  ]);

  const totalSnapshotDuration = snapshots.reduce((s, r) => s + r.durationMs, 0);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Analytics warehouse</CardTitle>
          <CardDescription>
            Daily snapshots, cohort sizes, trajectory scores, forecasts and insights.
            Triggers the same pipeline a cron would run.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <WarehouseClient />
        </CardContent>
      </Card>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Snapshot health</CardTitle>
            <CardDescription>Last 14 days</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1.5 text-xs">
            <Stat
              label="Latest capture"
              value={latest ? formatDateTime(latest.capturedFor) : "never"}
            />
            <Stat
              label="Snapshots stored"
              value={`${snapshots.length}`}
            />
            <Stat
              label="Total duration"
              value={`${totalSnapshotDuration}ms`}
            />
            <Stat
              label="Mean duration"
              value={
                snapshots.length === 0
                  ? "—"
                  : `${Math.round(totalSnapshotDuration / snapshots.length)}ms`
              }
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Forecast freshness</CardTitle>
            <CardDescription>Latest generation per metric</CardDescription>
          </CardHeader>
          <CardContent>
            {forecasts.length === 0 ? (
              <p className="text-xs text-muted-foreground">No forecasts yet.</p>
            ) : (
              <ul className="space-y-1 text-xs">
                {forecasts.map((f) => (
                  <li key={f.metric} className="flex items-center justify-between">
                    <span className="text-foreground">{f.payload?.label ?? f.metric}</span>
                    <span className="font-mono text-muted-foreground">
                      {f.payload
                        ? new Date(f.payload.generatedAt).toLocaleString()
                        : "—"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent insights</CardTitle>
            <CardDescription>Operator-facing one-liners</CardDescription>
          </CardHeader>
          <CardContent>
            {insights.length === 0 ? (
              <p className="text-xs text-muted-foreground">No insights generated.</p>
            ) : (
              <ul className="space-y-2 text-xs">
                {insights.slice(0, 6).map((i) => (
                  <li key={i.id}>
                    <p className="text-foreground">{i.headline}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {i.category} · {formatDateTime(i.createdAt)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Metric matrix</CardTitle>
          <CardDescription>
            Each row is a daily snapshot. Columns are metric keys.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {snapshots.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No snapshots yet. Run the warehouse to begin capture.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="py-1 pr-2 text-left font-medium">Day</th>
                    {metricList().slice(0, 8).map((k) => (
                      <th key={k} className="px-1 py-1 text-right font-medium">
                        {k}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border text-foreground">
                  {snapshots
                    .slice()
                    .reverse()
                    .map((s) => (
                      <tr key={s.id}>
                        <td className="py-1.5 pr-2 text-muted-foreground">
                          {s.capturedFor.toISOString().slice(0, 10)}
                        </td>
                        {metricList().slice(0, 8).map((k) => (
                          <td key={k} className="px-1 py-1.5 text-right font-mono">
                            {pickMetric(s.metrics, k)}
                          </td>
                        ))}
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono text-foreground">{value}</span>
    </div>
  );
}
