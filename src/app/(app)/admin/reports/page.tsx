import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getCurrentUser } from "@/server/session";
import { REPORTS, recentReports } from "@/services/analytics";
import { formatDateTime } from "@/lib/format";

const GOVERNANCE = [
  {
    kind: "governance",
    label: "Governance",
    description: "Automation rule status + recent fire counts + approval totals.",
  },
  {
    kind: "ai-usage",
    label: "AI usage (7d)",
    description: "Calls, latency and confidence by task + provider.",
  },
  {
    kind: "reliability",
    label: "Reliability",
    description: "Queue counts by status. Snapshot of the worker's state.",
  },
];

export const dynamic = "force-dynamic";

export default async function AdminReportsPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  const history = await recentReports(user.organizationId, 12);

  const analyticsReports = (Object.keys(REPORTS) as (keyof typeof REPORTS)[]).map(
    (kind) => ({
      kind,
      label: REPORTS[kind].label,
      description: REPORTS[kind].description,
    }),
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Analytics reports</CardTitle>
          <CardDescription>
            CSV exports backed by the warehouse — executive overview, cohorts, clinician
            workload and more.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="divide-y divide-border">
            {analyticsReports.map((r) => (
              <li
                key={r.kind}
                className="flex flex-wrap items-center justify-between gap-3 py-3"
              >
                <div>
                  <p className="text-sm font-medium text-foreground">{r.label}</p>
                  <p className="text-xs text-muted-foreground">{r.description}</p>
                </div>
                {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
                <a
                  href={`/api/analytics/reports/${r.kind}`}
                  className="inline-flex items-center gap-1 rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
                >
                  Download CSV
                </a>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Governance reports</CardTitle>
          <CardDescription>Existing operational exports.</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="divide-y divide-border">
            {GOVERNANCE.map((r) => (
              <li
                key={r.kind}
                className="flex flex-wrap items-center justify-between gap-3 py-3"
              >
                <div>
                  <p className="text-sm font-medium text-foreground">{r.label}</p>
                  <p className="text-xs text-muted-foreground">{r.description}</p>
                </div>
                {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
                <a
                  href={`/api/admin/reports/${r.kind}`}
                  className="inline-flex items-center gap-1 rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
                >
                  Download CSV
                </a>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent runs</CardTitle>
          <CardDescription>Persisted history with timings.</CardDescription>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <p className="text-xs text-muted-foreground">No runs yet.</p>
          ) : (
            <table className="w-full text-xs">
              <thead className="text-[10px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="py-1 text-left font-medium">Kind</th>
                  <th className="py-1 text-left font-medium">Started</th>
                  <th className="py-1 text-right font-medium">Duration</th>
                  <th className="py-1 text-left font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-foreground">
                {history.map((r) => (
                  <tr key={r.id}>
                    <td className="py-1.5">{r.kind}</td>
                    <td className="py-1.5 text-muted-foreground">
                      {formatDateTime(r.startedAt)}
                    </td>
                    <td className="py-1.5 text-right font-mono">{r.durationMs}ms</td>
                    <td className="py-1.5 text-muted-foreground">{r.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
