"use client";

import { useState } from "react";
import { toast } from "sonner";
import { fetcher } from "@/lib/fetcher";
import { Button } from "@/components/ui/button";
import type { WarehouseRunResult } from "@/services/analytics";

export function WarehouseClient() {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<WarehouseRunResult | null>(null);

  const run = async (path: string, label: string) => {
    setBusy(true);
    try {
      const r = await fetcher<WarehouseRunResult>(path, { method: "POST" });
      if ("steps" in r) setResult(r);
      toast.success(`${label} complete`);
    } catch (err) {
      toast.error(`${label} failed`, {
        description: err instanceof Error ? err.message : "unknown",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          onClick={() => run("/api/analytics/warehouse", "Warehouse run")}
          disabled={busy}
        >
          {busy ? "Running…" : "Run full warehouse"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => run("/api/analytics/snapshot", "Snapshot capture")}
          disabled={busy}
        >
          Capture snapshot
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => run("/api/analytics/forecasts", "Forecast generation")}
          disabled={busy}
        >
          Regenerate forecasts
        </Button>
      </div>
      {result ? (
        <div className="space-y-1 rounded-md border border-border bg-surface p-3 text-xs">
          <p className="text-foreground">
            Finished in <span className="font-mono">{result.durationMs}ms</span>
          </p>
          <ul className="space-y-1">
            {result.steps.map((s) => (
              <li
                key={s.name}
                className="flex items-center justify-between text-muted-foreground"
              >
                <span>
                  <span
                    className={
                      s.ok ? "text-emerald-600" : "text-rose-600"
                    }
                  >
                    {s.ok ? "✓" : "✗"}
                  </span>{" "}
                  {s.name}
                </span>
                <span className="font-mono">
                  {s.durationMs}ms{s.detail ? ` · ${s.detail}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
