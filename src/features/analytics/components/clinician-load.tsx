import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { ClinicianMetrics } from "@/services/analytics";

export function ClinicianLoad({
  metrics,
}: {
  metrics: ClinicianMetrics[];
}) {
  const max = Math.max(1, ...metrics.map((m) => m.loadIndex));
  return (
    <Card>
      <CardHeader>
        <CardTitle>Clinician workload</CardTitle>
        <CardDescription>
          Load index = active + critical×3 + overdue×2. Constructive view, not a ranking.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {metrics.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No clinicians with assigned patients yet.
          </p>
        ) : (
          <ul className="space-y-2.5">
            {metrics.slice(0, 10).map((m) => (
              <li key={m.userId} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-foreground">{m.name}</span>
                  <span className="font-mono text-muted-foreground">
                    {m.activePatients} active · {m.criticalPatients} critical · {m.overdueFollowups} overdue
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${Math.min(100, (m.loadIndex / max) * 100)}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
