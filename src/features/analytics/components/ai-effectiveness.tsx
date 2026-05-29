import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { AIEffectiveness } from "@/services/analytics";

export function AIEffectivenessPanel({ data }: { data: AIEffectiveness }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>AI effectiveness</CardTitle>
        <CardDescription>
          Provider mix, latency, confidence over the last {data.windowDays} days.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-2 text-xs">
          <Stat label="Runs" value={`${data.totalRuns}`} />
          <Stat
            label="Degraded"
            value={
              data.degradedRate == null
                ? "—"
                : `${Math.round(data.degradedRate * 100)}%`
            }
          />
          <Stat
            label="Regenerations"
            value={`${data.summaryRegenerations}`}
          />
        </div>

        {data.byProvider.length === 0 ? (
          <p className="text-xs text-muted-foreground">No AI runs in the window.</p>
        ) : (
          <table className="w-full text-xs">
            <thead className="text-[10px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="py-1 text-left font-medium">Provider</th>
                <th className="py-1 text-right font-medium">Runs</th>
                <th className="py-1 text-right font-medium">Avg ms</th>
                <th className="py-1 text-right font-medium">Avg conf</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-foreground">
              {data.byProvider.map((p) => (
                <tr key={p.provider}>
                  <td className="py-1.5">{p.provider}</td>
                  <td className="py-1.5 text-right font-mono">{p.runs}</td>
                  <td className="py-1.5 text-right font-mono">{p.avgLatencyMs}</td>
                  <td className="py-1.5 text-right font-mono">
                    {p.avgConfidence != null ? p.avgConfidence.toFixed(2) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Confidence distribution
          </p>
          <div className="grid grid-cols-4 gap-1">
            {data.confidenceDistribution.map((b) => (
              <div
                key={b.bucket}
                className="rounded-md bg-muted px-2 py-1.5 text-center"
              >
                <p className="text-[10px] text-muted-foreground">{b.bucket}</p>
                <p className="text-sm font-semibold text-foreground">{b.count}</p>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-surface p-2">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}
