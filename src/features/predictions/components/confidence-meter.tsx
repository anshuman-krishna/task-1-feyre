import { cn } from "@/lib/cn";

export function ConfidenceMeter({
  value,
  className,
}: {
  value: number | null | undefined;
  className?: string;
}) {
  const pct = value == null ? 0 : Math.round(value * 100);
  const tone =
    pct >= 80 ? "bg-emerald-500" : pct >= 60 ? "bg-amber-500" : pct > 0 ? "bg-orange-500" : "bg-muted";

  return (
    <div className={cn("space-y-1", className)}>
      <div className="flex items-baseline justify-between">
        <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          Confidence
        </span>
        <span className="font-mono text-xs text-foreground">{value == null ? "—" : pct + "%"}</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full transition-all", tone)}
          style={{ width: value == null ? "0%" : `${pct}%` }}
        />
      </div>
    </div>
  );
}
