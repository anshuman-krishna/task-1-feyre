"use client";

import { useState } from "react";
import { Sparkles, Wand2, Stethoscope, AlertOctagon, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/cn";
import { useRunCopilot, type CopilotAction, type CopilotResponse } from "../queries";

type ActionDef = {
  key: CopilotAction;
  label: string;
  description: string;
  icon: React.ElementType;
};

const ACTIONS: ActionDef[] = [
  {
    key: "urgent_review",
    label: "Patients needing urgent review",
    description: "Surfaces critical-tier and overdue cases for the next clinician hour.",
    icon: AlertOctagon,
  },
  {
    key: "unresolved_criticals",
    label: "Summarise unresolved criticals",
    description: "Bucketed digest: unreviewed criticals, overdue follow-ups, prediction failures.",
    icon: Wand2,
  },
  {
    key: "clinician_handoff",
    label: "Generate clinician handoff",
    description: "End-of-shift handoff narrative for the signed-in clinician.",
    icon: Stethoscope,
  },
];

export function CopilotPanel() {
  const [active, setActive] = useState<CopilotAction | null>(null);
  const [response, setResponse] = useState<CopilotResponse | null>(null);
  const run = useRunCopilot();

  const onRun = async (action: CopilotAction) => {
    setActive(action);
    try {
      const result = await run.mutateAsync(action);
      setResponse(result);
    } catch (err) {
      toast.error("Copilot failed", {
        description: err instanceof Error ? err.message : "unknown error",
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-3.5 w-3.5 text-primary" /> Operational copilot
        </CardTitle>
        <CardDescription>
          Embedded assistance — runs against live caseload data, structured outputs only.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {ACTIONS.map((a) => (
            <button
              key={a.key}
              onClick={() => onRun(a.key)}
              disabled={run.isPending}
              className={cn(
                "flex flex-col items-start gap-1 rounded-md border border-border bg-muted/30 px-3 py-2.5 text-left transition-colors hover:bg-muted/60 disabled:opacity-60",
                active === a.key && "ring-2 ring-primary/30",
              )}
            >
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-foreground">
                <a.icon className="h-3 w-3" /> {a.label}
              </span>
              <span className="text-[11px] text-muted-foreground">{a.description}</span>
            </button>
          ))}
        </div>

        {run.isPending && (
          <div className="space-y-2 rounded-md border border-dashed border-border p-3">
            <Skeleton className="h-3 w-2/3" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-5/6" />
          </div>
        )}

        {!run.isPending && response && (
          <CopilotOutput response={response} />
        )}
      </CardContent>
    </Card>
  );
}

function CopilotOutput({ response }: { response: CopilotResponse }) {
  const output = response.output as Record<string, unknown>;
  return (
    <div className="space-y-3 rounded-md border border-border bg-muted/30 p-4">
      <p className="text-sm font-medium text-foreground">{String(output.headline ?? "")}</p>

      {Array.isArray(output.highlights) && output.highlights.length > 0 && (
        <Section title="Highlights" items={output.highlights as string[]} />
      )}
      {Array.isArray(output.pendingDecisions) && output.pendingDecisions.length > 0 && (
        <Section title="Pending decisions" items={output.pendingDecisions as string[]} />
      )}
      {Array.isArray(output.buckets) && (
        <div className="space-y-2">
          {(output.buckets as { label: string; items: string[] }[]).map((b, i) => (
            <div key={i}>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {b.label}
              </p>
              <ul className="mt-1 space-y-0.5 text-xs text-foreground">
                {b.items.map((it, j) => (
                  <li key={j} className="flex gap-1.5">
                    <ArrowRight className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" />
                    {it}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
      {Array.isArray(output.patients) && (
        <ul className="space-y-1 text-xs">
          {(output.patients as { name: string; reason: string; risk?: string | null }[]).map(
            (p, i) => (
              <li
                key={i}
                className="flex items-start justify-between gap-3 border-t border-border pt-1.5 first:border-0 first:pt-0"
              >
                <span className="font-medium text-foreground">{p.name}</span>
                <span className="max-w-[60%] text-right text-muted-foreground">{p.reason}</span>
              </li>
            ),
          )}
        </ul>
      )}

      <p className="text-[10px] text-muted-foreground">
        {response.meta.provider}
        {response.meta.model ? ` · ${response.meta.model}` : ""} · {response.meta.latencyMs}ms
        {response.meta.degraded && " · degraded"}
      </p>
    </div>
  );
}

function Section({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </p>
      <ul className="mt-1 space-y-0.5 text-xs text-foreground">
        {items.map((it, i) => (
          <li key={i} className="flex gap-1.5">
            <ArrowRight className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" />
            {it}
          </li>
        ))}
      </ul>
    </div>
  );
}
