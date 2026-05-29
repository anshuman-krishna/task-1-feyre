"use client";

import { useEffect } from "react";
import { Brain, RefreshCw, AlertTriangle, Clock, ShieldCheck, ShieldQuestion } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/cn";
import { relativeTime } from "@/lib/format";
import { usePatientSummary, usePublishSummary, useRefreshSummary } from "../queries";

const severityTone: Record<"info" | "watch" | "concern" | "urgent", string> = {
  info: "bg-muted text-muted-foreground",
  watch: "bg-amber-50 text-amber-800",
  concern: "bg-orange-50 text-orange-800",
  urgent: "bg-red-50 text-red-700",
};

export function SummaryCard({ patientId }: { patientId: string }) {
  const { data: summary, isLoading } = usePatientSummary(patientId);
  const refresh = useRefreshSummary(patientId);
  const publish = usePublishSummary(patientId);

  // auto-generate the first time
  useEffect(() => {
    if (!isLoading && summary === null && !refresh.isPending) {
      refresh.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, summary]);

  const onRefresh = async () => {
    try {
      await refresh.mutateAsync();
      toast.success("Summary refreshed");
    } catch (err) {
      toast.error("Could not refresh summary", {
        description: err instanceof Error ? err.message : "unknown error",
      });
    }
  };

  const onPublish = async () => {
    try {
      await publish.mutateAsync();
      toast.success("Summary published");
    } catch (err) {
      toast.error("Could not publish summary", {
        description: err instanceof Error ? err.message : "unknown error",
      });
    }
  };

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-3.5 w-3.5 text-primary" />
            Patient summary
            {summary?.stale && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-800">
                <AlertTriangle className="h-2.5 w-2.5" /> Stale
              </span>
            )}
            {summary?.lowConfidence && (
              <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-2 py-0.5 text-[10px] font-medium text-orange-800">
                <ShieldQuestion className="h-2.5 w-2.5" /> Low confidence
              </span>
            )}
            {summary?.approvalState === "pending_review" && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-800">
                Pending review
              </span>
            )}
            {summary?.approvalState === "published" && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                <ShieldCheck className="h-2.5 w-2.5" /> Published
              </span>
            )}
          </CardTitle>
          <CardDescription>
            Generated narrative combining biomarkers, prediction history, and workflow signals.
          </CardDescription>
        </div>
        <div className="flex items-center gap-2">
          {summary?.approvalState === "pending_review" && (
            <Button size="sm" onClick={onPublish} disabled={publish.isPending}>
              {publish.isPending ? "Publishing…" : "Publish"}
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={onRefresh} disabled={refresh.isPending}>
            <RefreshCw className={cn("h-3.5 w-3.5", refresh.isPending && "animate-spin")} />
            {refresh.isPending ? "Refreshing…" : "Refresh"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading || (!summary && refresh.isPending) ? (
          <SummarySkeleton />
        ) : !summary ? (
          <p className="text-sm text-muted-foreground">No summary yet — generating now.</p>
        ) : (
          <>
            <div className="space-y-2">
              <p className="text-sm leading-relaxed text-foreground">{summary.overview}</p>
              <p className="text-xs italic text-muted-foreground">{summary.trajectory}</p>
            </div>

            {summary.observations.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Signals
                </p>
                <ul className="space-y-1.5">
                  {summary.observations.map((o, i) => (
                    <li key={i} className="flex items-start justify-between gap-3 text-sm">
                      <span className="flex items-center gap-2">
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-[10px] font-medium capitalize",
                            severityTone[o.severity],
                          )}
                        >
                          {o.severity}
                        </span>
                        <span className="text-foreground">{o.label}</span>
                      </span>
                      <span className="max-w-md text-right text-xs text-muted-foreground">
                        {o.detail}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {summary.recommendedActions.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Recommended actions
                </p>
                <ul className="space-y-1.5">
                  {summary.recommendedActions.map((a, i) => (
                    <li
                      key={i}
                      className="rounded-md border border-border bg-muted/30 px-3 py-2 text-sm"
                    >
                      <p className="text-foreground">{a.label}</p>
                      <p className="text-xs text-muted-foreground">{a.rationale}</p>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Brain className="h-3 w-3" />
                {summary.generatedBy}
                {summary.model ? ` · ${summary.model}` : ""}
              </span>
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {relativeTime(summary.updatedAt)}
              </span>
              <span>confidence {Math.round(summary.confidence * 100)}%</span>
              <span>
                rev {summary.revision} · {summary.promptId}@{summary.promptVersion}
              </span>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function SummarySkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-5/6" />
      <Skeleton className="h-4 w-2/3" />
    </div>
  );
}
