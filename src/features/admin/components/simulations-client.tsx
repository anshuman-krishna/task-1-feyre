"use client";

import { useState } from "react";
import { toast } from "sonner";
import { fetcher } from "@/lib/fetcher";
import { Button } from "@/components/ui/button";

const SIMS = [
  {
    kind: "queue_burst" as const,
    label: "Queue burst",
    description: "Enqueue N duplicate prediction jobs to exercise the worker under load.",
  },
  {
    kind: "provider_failure" as const,
    label: "Provider failure",
    description: "Trip the OpenAI circuit to confirm the internal heuristic takes over.",
  },
  {
    kind: "notification_storm" as const,
    label: "Notification storm",
    description:
      "Synthesise low-priority notifications under a shared groupKey to verify dedup under load.",
  },
];

type Result = { kind: string; intensity: number; result: Record<string, unknown> };

export function SimulationsClient() {
  const [intensity, setIntensity] = useState(5);
  const [running, setRunning] = useState<string | null>(null);
  const [history, setHistory] = useState<Result[]>([]);

  const onRun = async (kind: (typeof SIMS)[number]["kind"]) => {
    setRunning(kind);
    try {
      const result = await fetcher<Result>("/api/admin/simulations", {
        method: "POST",
        body: JSON.stringify({ kind, intensity }),
      });
      setHistory((h) => [result, ...h].slice(0, 10));
      toast.success(`${kind} ran`);
    } catch (err) {
      toast.error("Simulation failed", {
        description: err instanceof Error ? err.message : "unknown",
      });
    } finally {
      setRunning(null);
    }
  };

  return (
    <div className="space-y-4">
      <label className="flex items-center gap-3 text-xs">
        <span className="text-muted-foreground">Intensity</span>
        <input
          type="range"
          min={1}
          max={25}
          value={intensity}
          onChange={(e) => setIntensity(Number(e.target.value))}
          className="h-1 w-40"
        />
        <span className="font-mono text-foreground">{intensity}</span>
      </label>

      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {SIMS.map((s) => (
          <li
            key={s.kind}
            className="space-y-2 rounded-md border border-border bg-muted/30 p-3"
          >
            <p className="text-sm font-medium text-foreground">{s.label}</p>
            <p className="text-xs text-muted-foreground">{s.description}</p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onRun(s.kind)}
              disabled={running !== null}
            >
              {running === s.kind ? "Running…" : "Run"}
            </Button>
          </li>
        ))}
      </ul>

      {history.length > 0 && (
        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Recent results
          </p>
          <ul className="divide-y divide-border text-xs">
            {history.map((h, i) => (
              <li key={i} className="py-2">
                <p className="font-medium text-foreground">
                  {h.kind} · intensity {h.intensity}
                </p>
                <pre className="mt-0.5 overflow-x-auto rounded bg-muted/40 px-2 py-1 font-mono text-[10px] text-muted-foreground">
                  {JSON.stringify(h.result, null, 2)}
                </pre>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
