"use client";

import { useState } from "react";
import { toast } from "sonner";
import { fetcher } from "@/lib/fetcher";
import { Button } from "@/components/ui/button";

type Props = {
  kind: string;
  initial: Record<string, unknown>;
  defaults: Record<string, unknown>;
  revision: number;
  enabled: boolean;
};

export function PolicyEditor({ kind, initial, defaults, revision, enabled }: Props) {
  const [text, setText] = useState(JSON.stringify(initial, null, 2));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSave = async () => {
    setBusy(true);
    setError(null);
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      setError(e instanceof Error ? e.message : "invalid JSON");
      setBusy(false);
      return;
    }
    try {
      await fetcher("/api/admin/policies", {
        method: "PATCH",
        body: JSON.stringify({ kind, config: parsed }),
      });
      toast.success(`${kind} policy saved`);
    } catch (e) {
      toast.error("Save failed", {
        description: e instanceof Error ? e.message : "unknown",
      });
    } finally {
      setBusy(false);
    }
  };

  const onReset = () => {
    setText(JSON.stringify(defaults, null, 2));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <span>
          Revision {revision} · {enabled ? "active" : "disabled"}
        </span>
        <button
          onClick={onReset}
          className="text-muted-foreground transition-colors hover:text-foreground"
        >
          Reset to defaults
        </button>
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        spellCheck={false}
        className="h-44 w-full rounded-md border border-border bg-surface px-3 py-2 font-mono text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="flex justify-end">
        <Button size="sm" onClick={onSave} disabled={busy}>
          {busy ? "Saving…" : "Save policy"}
        </Button>
      </div>
    </div>
  );
}
