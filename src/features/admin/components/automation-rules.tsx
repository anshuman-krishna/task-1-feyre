"use client";

import { useState } from "react";
import { toast } from "sonner";
import { fetcher } from "@/lib/fetcher";

type Rule = {
  key: string;
  name: string;
  description: string;
  trigger: string;
  enabled: boolean;
  fireCount: number;
  lastFiredAt: string | null;
};

export function AutomationRulesClient({ rules }: { rules: Rule[] }) {
  const [state, setState] = useState(rules);
  const [busy, setBusy] = useState<string | null>(null);

  const onToggle = async (key: string, next: boolean) => {
    setBusy(key);
    const prev = state.map((r) => ({ ...r }));
    setState((s) => s.map((r) => (r.key === key ? { ...r, enabled: next } : r)));
    try {
      await fetcher(`/api/automation/rules`, {
        method: "PATCH",
        body: JSON.stringify({ key, enabled: next }),
      });
      toast.success(`Rule ${next ? "enabled" : "disabled"}`);
    } catch (err) {
      setState(prev);
      toast.error("Could not toggle rule", {
        description: err instanceof Error ? err.message : "unknown error",
      });
    } finally {
      setBusy(null);
    }
  };

  return (
    <ul className="divide-y divide-border">
      {state.map((r) => (
        <li key={r.key} className="flex flex-wrap items-start justify-between gap-3 py-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-foreground">{r.name}</p>
            <p className="text-xs text-muted-foreground">{r.description}</p>
            <p className="mt-1 text-[10px] text-muted-foreground">
              trigger · {r.trigger} · fired {r.fireCount} times
              {r.lastFiredAt ? ` · last ${r.lastFiredAt}` : ""}
            </p>
          </div>
          <label className="inline-flex cursor-pointer items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={r.enabled}
              disabled={busy === r.key}
              onChange={(e) => onToggle(r.key, e.target.checked)}
              className="h-4 w-4"
            />
            <span className="text-muted-foreground">{r.enabled ? "Enabled" : "Disabled"}</span>
          </label>
        </li>
      ))}
    </ul>
  );
}
