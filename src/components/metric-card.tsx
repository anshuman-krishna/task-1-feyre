import * as React from "react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/cn";

type Trend = "up" | "down" | "flat";

export function MetricCard({
  label,
  value,
  hint,
  trend,
  delta,
  icon,
  accent,
}: {
  label: string;
  value: string | number;
  hint?: string;
  trend?: Trend;
  delta?: string;
  icon?: React.ReactNode;
  accent?: boolean;
}) {
  const TrendIcon = trend === "up" ? ArrowUpRight : trend === "down" ? ArrowDownRight : Minus;
  const trendColor =
    trend === "up"
      ? "text-emerald-600"
      : trend === "down"
        ? "text-red-600"
        : "text-muted-foreground";

  return (
    <Card className={cn("p-5", accent && "ring-1 ring-primary/10")}>
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          <p className="text-2xl font-semibold tracking-tight text-foreground">{value}</p>
        </div>
        {icon ? (
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-accent text-accent-foreground">
            {icon}
          </div>
        ) : null}
      </div>
      {(hint || delta) && (
        <div className="mt-3 flex items-center gap-2 text-xs">
          {delta && (
            <span className={cn("inline-flex items-center gap-0.5 font-medium", trendColor)}>
              <TrendIcon className="h-3 w-3" />
              {delta}
            </span>
          )}
          {hint && <span className="text-muted-foreground">{hint}</span>}
        </div>
      )}
    </Card>
  );
}
