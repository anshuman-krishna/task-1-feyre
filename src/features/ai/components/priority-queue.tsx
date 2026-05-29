import Link from "next/link";
import { Flame } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RiskBadge } from "@/components/risk-badge";
import { Avatar } from "@/components/avatar";
import { cn } from "@/lib/cn";

type PriorityRow = {
  patientId: string;
  score: number;
  band: string;
  reasons: { label: string; weight: number }[];
  patient: {
    id: string;
    fullName: string;
    riskLevel: "low" | "moderate" | "elevated" | "critical" | null;
    status: string;
    assignedTo: { name: string; avatarHue: number } | null;
  };
};

const bandTone: Record<string, string> = {
  now: "bg-red-50 text-red-700",
  soon: "bg-orange-50 text-orange-800",
  watch: "bg-amber-50 text-amber-800",
  quiet: "bg-muted text-muted-foreground",
};

export function PriorityQueue({ rows }: { rows: PriorityRow[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Flame className="h-3.5 w-3.5 text-primary" /> Patients requiring attention now
        </CardTitle>
        <CardDescription>
          Ranked by risk, freshness, trajectory and follow-up state. Reasons are explainable.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nothing scored above the quiet band. Caseload is healthy.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((r) => (
              <li key={r.patientId} className="flex items-start justify-between gap-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/patients/${r.patient.id}`}
                    className="text-sm font-medium text-foreground hover:underline"
                  >
                    {r.patient.fullName}
                  </Link>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {r.reasons.map((x) => x.label).join(" · ")}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <RiskBadge level={r.patient.riskLevel} />
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[10px] font-medium capitalize",
                      bandTone[r.band] ?? bandTone.quiet,
                    )}
                  >
                    {r.band} · {Math.round(r.score)}
                  </span>
                  {r.patient.assignedTo && (
                    <Avatar
                      name={r.patient.assignedTo.name}
                      hue={r.patient.assignedTo.avatarHue}
                      size={20}
                    />
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
