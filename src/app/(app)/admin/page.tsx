import { deepHealth } from "@/server/health";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser } from "@/server/session";
import { lastSnapshot } from "@/services/backup";
import { listApprovals } from "@/services/governance";
import { recentRuns, aiUsageReport } from "@/services/governance/lineage";
import { recentAutomationEvents } from "@/services/automation";
import { jobCountsByStatus } from "@/services/queue/admin";
import { formatDateTime, relativeTime } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AdminOverviewPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const [health, queue, snapshot, approvals, runs, usage, automation] = await Promise.all([
    deepHealth(),
    jobCountsByStatus(),
    lastSnapshot(user.organizationId),
    listApprovals(user.organizationId, { state: "pending", limit: 5 }),
    recentRuns(user.organizationId, 5),
    aiUsageReport(user.organizationId),
    recentAutomationEvents(user.organizationId, 5),
  ]);

  return (
    <div className="space-y-4">
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <Tile label="System" value={health.status.toUpperCase()} hint="db + queue + providers" />
        <Tile
          label="Queue"
          value={`${queue.queued + queue.processing} active`}
          hint={`${queue.dead} dead · ${queue.failed} failed`}
        />
        <Tile
          label="Approvals"
          value={`${approvals.length}`}
          hint="pending decisions"
        />
        <Tile
          label="Last backup"
          value={snapshot ? relativeTime(snapshot.createdAt) : "never"}
          hint={snapshot ? `${snapshot.bytes} bytes` : "no snapshot yet"}
        />
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent AI runs</CardTitle>
            <CardDescription>Lineage — every orchestrator call.</CardDescription>
          </CardHeader>
          <CardContent>
            {runs.length === 0 ? (
              <p className="text-sm text-muted-foreground">No runs yet.</p>
            ) : (
              <ul className="divide-y divide-border text-xs">
                {runs.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-3 py-2">
                    <div>
                      <p className="font-medium text-foreground">{r.task}</p>
                      <p className="text-muted-foreground">
                        {r.provider}
                        {r.model ? ` · ${r.model}` : ""} · {r.promptId}@{r.promptVersion}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-mono text-muted-foreground">{r.latencyMs}ms</p>
                      <p className="text-[10px] text-muted-foreground">{formatDateTime(r.createdAt)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>AI usage · last 7 days</CardTitle>
            <CardDescription>Calls, latency, confidence by task and provider.</CardDescription>
          </CardHeader>
          <CardContent>
            {usage.length === 0 ? (
              <p className="text-sm text-muted-foreground">No usage in the window.</p>
            ) : (
              <table className="w-full text-xs">
                <thead className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="py-1 text-left font-medium">Task</th>
                    <th className="py-1 text-left font-medium">Provider</th>
                    <th className="py-1 text-right font-medium">Runs</th>
                    <th className="py-1 text-right font-medium">Avg ms</th>
                    <th className="py-1 text-right font-medium">Avg conf.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border text-foreground">
                  {usage.map((u, i) => (
                    <tr key={i}>
                      <td className="py-1.5">{u.task}</td>
                      <td className="py-1.5">{u.provider}</td>
                      <td className="py-1.5 text-right font-mono">{u._count._all}</td>
                      <td className="py-1.5 text-right font-mono">
                        {u._avg.latencyMs ? Math.round(u._avg.latencyMs) : "—"}
                      </td>
                      <td className="py-1.5 text-right font-mono">
                        {u._avg.confidence != null ? u._avg.confidence.toFixed(2) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Recent automation</CardTitle>
          <CardDescription>Last rule fires with lineage to triggers.</CardDescription>
        </CardHeader>
        <CardContent>
          {automation.length === 0 ? (
            <p className="text-sm text-muted-foreground">No fires yet.</p>
          ) : (
            <ul className="divide-y divide-border text-xs">
              {automation.map((e) => (
                <li key={e.id} className="py-2">
                  <p className="font-medium text-foreground">{e.ruleName}</p>
                  <p className="text-muted-foreground">
                    <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wide">
                      {e.trigger}
                    </span>{" "}
                    · {e.reason}
                    {e.patient ? ` · ${e.patient.fullName}` : ""}
                  </p>
                  <p className="text-[10px] text-muted-foreground">{formatDateTime(e.createdAt)}</p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Tile({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="space-y-0.5 rounded-md border border-border bg-surface p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="text-lg font-semibold text-foreground">{value}</p>
      <p className="text-[11px] text-muted-foreground">{hint}</p>
    </div>
  );
}
