import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, Minus, Waves } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/cn";

type Distribution = Record<"improving" | "stable" | "deteriorating" | "volatile", number>;

type DeterioratingRow = {
  patientId: string;
  patient: { id: string; fullName: string; riskLevel: string | null };
  score: number;
  confidence: number;
};

export function TrajectoryOverview({
  distribution,
  deteriorating,
}: {
  distribution: Distribution;
  deteriorating: DeterioratingRow[];
}) {
  const total = Object.values(distribution).reduce((a, b) => a + b, 0) || 1;
  const entries: { key: keyof Distribution; label: string; icon: typeof ArrowUpRight; tone: string }[] = [
    { key: "improving", label: "Improving", icon: ArrowDownRight, tone: "text-emerald-600" },
    { key: "stable", label: "Stable", icon: Minus, tone: "text-muted-foreground" },
    { key: "deteriorating", label: "Deteriorating", icon: ArrowUpRight, tone: "text-rose-600" },
    { key: "volatile", label: "Volatile", icon: Waves, tone: "text-amber-600" },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Patient trajectories</CardTitle>
        <CardDescription>
          Direction of health movement, derived from risk band + biomarker + workflow signals.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <ul className="grid grid-cols-4 gap-2">
          {entries.map((e) => {
            const value = distribution[e.key];
            const Icon = e.icon;
            return (
              <li
                key={e.key}
                className="rounded-md border border-border bg-surface p-2"
              >
                <div className={cn("flex items-center gap-1 text-xs font-medium", e.tone)}>
                  <Icon className="h-3 w-3" />
                  {e.label}
                </div>
                <p className="mt-1 text-lg font-semibold text-foreground">{value}</p>
                <p className="text-[10px] text-muted-foreground">
                  {Math.round((value / total) * 100)}% of cohort
                </p>
              </li>
            );
          })}
        </ul>

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Sharpest deteriorating
          </p>
          {deteriorating.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No patients on a deteriorating trajectory.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {deteriorating.slice(0, 5).map((row) => (
                <li
                  key={row.patientId}
                  className="flex items-center justify-between py-2"
                >
                  <div>
                    <Link
                      href={`/patients/${row.patient.id}`}
                      className="text-sm font-medium text-foreground hover:underline"
                    >
                      {row.patient.fullName}
                    </Link>
                    <p className="text-[11px] text-muted-foreground">
                      Risk: {row.patient.riskLevel ?? "—"} · confidence{" "}
                      {Math.round(row.confidence * 100)}%
                    </p>
                  </div>
                  <span className="font-mono text-xs text-rose-600">
                    +{Math.round(row.score)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
