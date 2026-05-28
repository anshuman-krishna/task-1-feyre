import { Sparkles } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { RiskBadge } from "@/components/risk-badge";
import { EmptyState } from "@/components/empty-state";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/cn";

type TimelineEntry = {
  id: string;
  provider: string;
  riskLevel: "low" | "moderate" | "elevated" | "critical";
  condition: string;
  confidence: number;
  summary: string;
  latencyMs: number;
  error: string | null;
  createdAt: string;
};

export function PredictionTimeline({ entries }: { entries: TimelineEntry[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Prediction history</CardTitle>
        <CardDescription>Every AI run logged for this patient.</CardDescription>
      </CardHeader>
      <CardContent>
        {entries.length === 0 ? (
          <EmptyState
            icon={<Sparkles className="h-4 w-4" />}
            title="No predictions yet"
            description="Once a prediction is generated, every run shows up here with provider, latency, and confidence."
          />
        ) : (
          <ol className="relative space-y-5 border-l border-border pl-5">
            {entries.map((entry) => (
              <li key={entry.id} className="relative">
                <span
                  className={cn(
                    "absolute -left-[1.55rem] mt-1 flex h-3 w-3 items-center justify-center rounded-full ring-4 ring-background",
                    entry.error
                      ? "bg-red-500"
                      : entry.riskLevel === "critical"
                        ? "bg-red-500"
                        : entry.riskLevel === "elevated"
                          ? "bg-orange-500"
                          : entry.riskLevel === "moderate"
                            ? "bg-amber-500"
                            : "bg-emerald-500",
                  )}
                />
                <div className="flex flex-wrap items-baseline gap-2">
                  <p className="text-sm font-medium capitalize text-foreground">{entry.condition}</p>
                  <RiskBadge level={entry.riskLevel} showDot={false} />
                  <span className="ml-auto text-xs text-muted-foreground">
                    {formatDateTime(entry.createdAt)}
                  </span>
                </div>
                <p className="mt-1 max-w-prose text-xs text-muted-foreground">{entry.summary}</p>
                <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                  <span>provider: {entry.provider}</span>
                  <span>·</span>
                  <span className="font-mono">confidence {(entry.confidence * 100).toFixed(0)}%</span>
                  <span>·</span>
                  <span>{entry.latencyMs}ms</span>
                  {entry.error && (
                    <>
                      <span>·</span>
                      <span className="text-destructive">failed</span>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
