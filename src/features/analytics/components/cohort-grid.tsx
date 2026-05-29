import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/cn";

type Row = {
  kind: string;
  label: string;
  description: string;
  size: number;
  delta: number;
};

export function CohortGrid({ cohorts }: { cohorts: Row[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Patient cohorts</CardTitle>
        <CardDescription>
          Live segments with delta against the prior snapshot.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {cohorts.map((c) => {
            const TrendIcon = c.delta > 0 ? ArrowUp : c.delta < 0 ? ArrowDown : Minus;
            const isFriendly =
              (c.kind === "critical_risk" && c.delta < 0) ||
              (c.kind === "followup_overdue" && c.delta < 0) ||
              (c.kind === "unreviewed_critical" && c.delta < 0) ||
              (c.kind === "high_improvement" && c.delta > 0) ||
              (c.kind === "newly_stable" && c.delta > 0);
            const trendColor =
              c.delta === 0
                ? "text-muted-foreground"
                : isFriendly
                  ? "text-emerald-600"
                  : "text-rose-600";
            return (
              <li
                key={c.kind}
                className="flex items-start justify-between gap-3 rounded-md border border-border bg-surface p-3"
              >
                <div className="space-y-0.5">
                  <p className="text-sm font-medium text-foreground">{c.label}</p>
                  <p className="text-[11px] text-muted-foreground">{c.description}</p>
                </div>
                <div className="text-right">
                  <p className="text-xl font-semibold tabular-nums text-foreground">
                    {c.size}
                  </p>
                  <p
                    className={cn(
                      "inline-flex items-center gap-0.5 text-[11px] font-medium",
                      trendColor,
                    )}
                  >
                    <TrendIcon className="h-3 w-3" />
                    {c.delta === 0 ? "no change" : c.delta > 0 ? `+${c.delta}` : c.delta}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
