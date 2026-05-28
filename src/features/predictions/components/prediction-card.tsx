"use client";

import { Sparkles, Activity } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { RiskBadge } from "@/components/risk-badge";
import { EmptyState } from "@/components/empty-state";
import { cn } from "@/lib/cn";
import { formatDateTime } from "@/lib/format";
import { useRunPrediction } from "@/features/patients/queries";
import { toast } from "sonner";
import { ConfidenceMeter } from "./confidence-meter";

type Observation = {
  label: string;
  value: number | null;
  status: "ok" | "watch" | "elevated" | "critical";
  hint: string;
};

type LatestPrediction = {
  id: string;
  riskLevel: "low" | "moderate" | "elevated" | "critical";
  condition: string;
  confidence: number;
  summary: string;
  recommendations: string[];
  observations: Observation[];
  provider: string;
  model: string | null;
  createdAt: string;
} | null;

const obsTone: Record<Observation["status"], string> = {
  ok: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  watch: "bg-amber-50 text-amber-800 ring-amber-100",
  elevated: "bg-orange-50 text-orange-800 ring-orange-100",
  critical: "bg-red-50 text-red-700 ring-red-100",
};

export function PredictionCard({
  patientId,
  latest,
  hasBiomarkers,
}: {
  patientId: string;
  latest: LatestPrediction;
  hasBiomarkers: boolean;
}) {
  const run = useRunPrediction();

  const onRun = async () => {
    try {
      await run.mutateAsync(patientId);
      toast.success("Prediction updated");
    } catch (err) {
      toast.error("Prediction failed", {
        description: err instanceof Error ? err.message : "unknown error",
      });
    }
  };

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 text-primary" /> AI observation
          </CardTitle>
          <CardDescription>
            {latest
              ? `${latest.provider}${latest.model ? ` · ${latest.model}` : ""} · ${formatDateTime(latest.createdAt)}`
              : "Run the prediction engine to generate observations."}
          </CardDescription>
        </div>
        <Button size="sm" onClick={onRun} disabled={run.isPending || !hasBiomarkers}>
          <Activity className={cn("h-3.5 w-3.5", run.isPending && "animate-pulse")} />
          {run.isPending ? "Running…" : "Run prediction"}
        </Button>
      </CardHeader>

      {latest ? (
        <CardContent className="space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <p className="text-sm font-medium capitalize text-foreground">{latest.condition}</p>
              <p className="max-w-prose text-xs text-muted-foreground">{latest.summary}</p>
            </div>
            <div className="space-y-2 text-right">
              <RiskBadge level={latest.riskLevel} />
              <ConfidenceMeter value={latest.confidence} className="w-40" />
            </div>
          </div>

          {latest.observations.length > 0 && (
            <>
              <Separator />
              <div className="space-y-2">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Supporting findings
                </p>
                <ul className="space-y-1.5">
                  {latest.observations.map((o, i) => (
                    <li key={i} className="flex items-start justify-between gap-3 text-sm">
                      <span className="flex items-center gap-2">
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ring-inset capitalize",
                            obsTone[o.status],
                          )}
                        >
                          {o.status}
                        </span>
                        <span className="text-foreground">{o.label}</span>
                        {o.value != null && (
                          <span className="font-mono text-xs text-muted-foreground">{o.value}</span>
                        )}
                      </span>
                      <span className="text-xs text-muted-foreground">{o.hint}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}

          {latest.recommendations.length > 0 && (
            <>
              <Separator />
              <div className="space-y-2">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Recommendations
                </p>
                <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                  {latest.recommendations.map((r, i) => (
                    <li
                      key={i}
                      className="rounded-md border border-border bg-muted/30 px-3 py-2 text-xs text-foreground"
                    >
                      {r}
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}

          <p className="rounded-md bg-muted/40 px-3 py-2 text-[11px] text-muted-foreground">
            AI-generated observation. Not a medical diagnosis — review with a qualified clinician.
          </p>
        </CardContent>
      ) : (
        <CardContent>
          <EmptyState
            icon={<Sparkles className="h-4 w-4" />}
            title={hasBiomarkers ? "No prediction yet" : "Add biomarkers to enable predictions"}
            description={
              hasBiomarkers
                ? "Run the prediction engine to generate the first observation."
                : "The prediction layer needs at least one biomarker value to produce observations."
            }
          />
        </CardContent>
      )}
    </Card>
  );
}
