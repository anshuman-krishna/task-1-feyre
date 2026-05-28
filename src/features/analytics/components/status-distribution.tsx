import type { WorkflowStatus } from "@prisma/client";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { STATUS_LABELS, STATUS_ORDER } from "@/services/workflow";
import { cn } from "@/lib/cn";

const tone: Record<WorkflowStatus, string> = {
  urgent_review: "bg-red-500",
  follow_up_needed: "bg-amber-500",
  monitoring: "bg-sky-500",
  new_patient: "bg-slate-400",
  stable: "bg-emerald-500",
};

export function StatusDistribution({
  data,
}: {
  data: Record<WorkflowStatus, number>;
}) {
  const total = Object.values(data).reduce((a, b) => a + b, 0);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Workflow status</CardTitle>
        <CardDescription>Where active patients sit in the clinical workflow.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* stacked share bar */}
        <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted">
          {STATUS_ORDER.map((s) => {
            const v = data[s];
            if (!v) return null;
            return (
              <div
                key={s}
                className={cn("h-full transition-all", tone[s])}
                style={{ width: `${(v / Math.max(1, total)) * 100}%` }}
                title={`${STATUS_LABELS[s]}: ${v}`}
              />
            );
          })}
        </div>
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {STATUS_ORDER.map((s) => (
            <li key={s} className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2">
                <span className={cn("h-2 w-2 rounded-full", tone[s])} />
                <span className="text-sm text-foreground">{STATUS_LABELS[s]}</span>
              </span>
              <span className="font-mono text-xs text-muted-foreground">{data[s]}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
