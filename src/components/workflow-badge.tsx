import type { WorkflowStatus } from "@prisma/client";
import { cn } from "@/lib/cn";

const styles: Record<WorkflowStatus, { tint: string; dot: string; label: string }> = {
  new_patient: {
    tint: "bg-slate-50 text-slate-700 ring-slate-200",
    dot: "bg-slate-400",
    label: "New",
  },
  monitoring: {
    tint: "bg-sky-50 text-sky-700 ring-sky-100",
    dot: "bg-sky-500",
    label: "Monitoring",
  },
  follow_up_needed: {
    tint: "bg-amber-50 text-amber-800 ring-amber-100",
    dot: "bg-amber-500",
    label: "Follow-up",
  },
  stable: {
    tint: "bg-emerald-50 text-emerald-700 ring-emerald-100",
    dot: "bg-emerald-500",
    label: "Stable",
  },
  urgent_review: {
    tint: "bg-red-50 text-red-700 ring-red-100",
    dot: "bg-red-500",
    label: "Urgent review",
  },
};

export function WorkflowBadge({
  status,
  className,
}: {
  status: WorkflowStatus;
  className?: string;
}) {
  const s = styles[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
        s.tint,
        className,
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", s.dot)} />
      {s.label}
    </span>
  );
}
