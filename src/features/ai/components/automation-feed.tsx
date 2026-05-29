import Link from "next/link";
import { Workflow } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { relativeTime } from "@/lib/format";

type Row = {
  id: string;
  ruleKey: string;
  ruleName: string;
  trigger: string;
  reason: string;
  actions: { kind: string; ok: boolean; detail?: string }[];
  patient: { id: string; fullName: string } | null;
  createdAt: Date | string;
};

const triggerLabel: Record<string, string> = {
  prediction_completed: "Prediction completed",
  prediction_dead_letter: "Job dead-letter",
  follow_up_overdue: "Follow-up overdue",
  critical_unreviewed: "Critical unreviewed",
  status_inactive: "Status inactive",
  biomarker_anomaly: "Biomarker anomaly",
};

export function AutomationFeed({ rows }: { rows: Row[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Workflow className="h-3.5 w-3.5 text-primary" /> Automation activity
        </CardTitle>
        <CardDescription>
          Recent rule fires. Every event is auditable and explains why it happened.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No automation fires yet.</p>
        ) : (
          <ul className="space-y-2.5">
            {rows.map((r) => (
              <li key={r.id} className="space-y-1 border-l-2 border-primary/40 pl-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-sm text-foreground">{r.ruleName}</p>
                  <span className="text-[11px] text-muted-foreground">
                    {relativeTime(r.createdAt)}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wide">
                    {triggerLabel[r.trigger] ?? r.trigger}
                  </span>{" "}
                  · {r.reason}
                </p>
                {(r.patient || r.actions.length > 0) && (
                  <p className="text-[11px] text-muted-foreground">
                    {r.patient && (
                      <Link
                        href={`/patients/${r.patient.id}`}
                        className="text-foreground hover:underline"
                      >
                        {r.patient.fullName}
                      </Link>
                    )}
                    {r.patient && r.actions.length > 0 && " · "}
                    {r.actions
                      .filter((a) => a.ok)
                      .map((a) => a.kind)
                      .join(", ")}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
