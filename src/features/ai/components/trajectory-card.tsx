import { ArrowDownRight, ArrowUpRight, Minus, Waves } from "lucide-react";
import { prisma } from "@/server/prisma";
import { computeTrajectory } from "@/services/analytics";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/cn";

export async function TrajectoryCard({ patientId }: { patientId: string }) {
  const [cached, fresh] = await Promise.all([
    prisma.trajectoryScore.findUnique({ where: { patientId } }),
    computeTrajectory(patientId),
  ]);
  const data = fresh ?? cached;
  if (!data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Trajectory</CardTitle>
          <CardDescription>
            Not enough history to compute a direction yet.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const Icon =
    data.direction === "improving"
      ? ArrowDownRight
      : data.direction === "deteriorating"
        ? ArrowUpRight
        : data.direction === "volatile"
          ? Waves
          : Minus;

  const tone =
    data.direction === "improving"
      ? "text-emerald-600 bg-emerald-50"
      : data.direction === "deteriorating"
        ? "text-rose-600 bg-rose-50"
        : data.direction === "volatile"
          ? "text-amber-600 bg-amber-50"
          : "text-muted-foreground bg-muted";

  const drivers = (data.drivers as { label: string; weight: number; detail: string }[]) ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Trajectory</CardTitle>
        <CardDescription>
          Direction of health movement from prediction, biomarker and workflow signals.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-3">
          <span className={cn("flex h-10 w-10 items-center justify-center rounded-md", tone)}>
            <Icon className="h-5 w-5" />
          </span>
          <div>
            <p className="text-lg font-semibold capitalize text-foreground">
              {data.direction}
            </p>
            <p className="text-xs text-muted-foreground">
              Score {Math.round(data.score)} · confidence {Math.round(data.confidence * 100)}%
            </p>
          </div>
        </div>

        {drivers.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No active drivers — the trajectory is dominated by absence of new signals.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {drivers.slice(0, 6).map((d, i) => (
              <li key={i} className="flex items-center justify-between text-xs">
                <div>
                  <p className="text-foreground">{d.label}</p>
                  <p className="text-[11px] text-muted-foreground">{d.detail}</p>
                </div>
                <span
                  className={cn(
                    "font-mono",
                    d.weight > 0 ? "text-rose-600" : "text-emerald-600",
                  )}
                >
                  {d.weight > 0 ? `+${d.weight}` : d.weight}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
