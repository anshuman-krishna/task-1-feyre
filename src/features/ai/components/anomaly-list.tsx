"use client";

import { AlertCircle, TrendingUp, Workflow, RefreshCw } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/cn";
import { useAnomalies } from "../queries";

const iconFor = {
  biomarker_spike: TrendingUp,
  recurring_flag: RefreshCw,
  workflow_gap: Workflow,
};

const severityTone = {
  watch: "bg-amber-50 text-amber-800 ring-amber-100",
  concern: "bg-orange-50 text-orange-800 ring-orange-100",
  urgent: "bg-red-50 text-red-700 ring-red-100",
};

export function AnomalyList({ patientId }: { patientId: string }) {
  const { data, isLoading } = useAnomalies(patientId);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertCircle className="h-3.5 w-3.5 text-primary" /> Anomalies
        </CardTitle>
        <CardDescription>
          Detected against the patient&apos;s own history — biomarker spikes, recurring flags, workflow gaps.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-3/4" />
          </div>
        ) : !data || data.length === 0 ? (
          <p className="text-sm text-muted-foreground">No anomalies detected.</p>
        ) : (
          <ul className="space-y-2">
            {data.map((a, i) => {
              const Icon = iconFor[a.kind];
              return (
                <li key={i} className="flex items-start gap-3 text-sm">
                  <span
                    className={cn(
                      "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md ring-1 ring-inset",
                      severityTone[a.severity],
                    )}
                  >
                    <Icon className="h-3 w-3" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-foreground">{a.label}</p>
                    <p className="text-xs text-muted-foreground">{a.detail}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
