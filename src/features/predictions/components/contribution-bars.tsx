import { cn } from "@/lib/cn";

type Contribution = { label: string; weight: number; direction: "up" | "neutral" };

export function ContributionBars({ items }: { items: Contribution[] }) {
  if (items.length === 0) return null;
  const driving = items.filter((c) => c.weight > 0);
  if (driving.length === 0) return null;
  return (
    <div className="space-y-2">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        What drove this classification
      </p>
      <ul className="space-y-1.5">
        {items.map((c) => (
          <li key={c.label} className="grid grid-cols-[1fr_auto] items-center gap-x-3">
            <div className="flex items-center gap-2">
              <span className="w-32 shrink-0 truncate text-xs text-foreground">{c.label}</span>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                <div
                  className={cn(
                    "h-full transition-all",
                    c.direction === "up" ? "bg-orange-500" : "bg-emerald-500",
                  )}
                  style={{ width: `${Math.round(c.weight * 100)}%` }}
                />
              </div>
            </div>
            <span className="font-mono text-[11px] text-muted-foreground">
              {Math.round(c.weight * 100)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
