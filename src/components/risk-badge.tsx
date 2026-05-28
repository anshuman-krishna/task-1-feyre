import { cn } from "@/lib/cn";

export type RiskLevel = "low" | "moderate" | "elevated" | "critical";

const styles: Record<RiskLevel, string> = {
  low: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  moderate: "bg-amber-50 text-amber-800 ring-amber-100",
  elevated: "bg-orange-50 text-orange-800 ring-orange-100",
  critical: "bg-red-50 text-red-700 ring-red-100",
};

const dotStyles: Record<RiskLevel, string> = {
  low: "bg-emerald-500",
  moderate: "bg-amber-500",
  elevated: "bg-orange-500",
  critical: "bg-red-500",
};

export function RiskBadge({
  level,
  className,
  showDot = true,
}: {
  level: RiskLevel | null | undefined;
  className?: string;
  showDot?: boolean;
}) {
  if (!level) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
          "bg-muted text-muted-foreground ring-border",
          className,
        )}
      >
        unassessed
      </span>
    );
  }
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset capitalize",
        styles[level],
        className,
      )}
    >
      {showDot ? <span className={cn("h-1.5 w-1.5 rounded-full", dotStyles[level])} /> : null}
      {level}
    </span>
  );
}
