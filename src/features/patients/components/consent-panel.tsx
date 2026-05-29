"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ShieldCheck } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { fetcher } from "@/lib/fetcher";

type Props = {
  patientId: string;
  initial: {
    consentResearch: boolean;
    consentDataSharing: boolean;
    retentionUntil: string | null;
  };
};

export function ConsentPanel({ patientId, initial }: Props) {
  const [state, setState] = useState(initial);
  const [busy, setBusy] = useState(false);

  const update = async (patch: Partial<typeof state>) => {
    setBusy(true);
    const prev = { ...state };
    setState((s) => ({ ...s, ...patch }));
    try {
      await fetcher(`/api/patients/${patientId}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      });
      toast.success("Compliance updated");
    } catch (err) {
      setState(prev);
      toast.error("Update failed", {
        description: err instanceof Error ? err.message : "unknown",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="h-3.5 w-3.5 text-primary" /> Consent &amp; retention
        </CardTitle>
        <CardDescription>
          Tracked for compliance. Every change is audited.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <label className="flex items-center justify-between gap-3">
          <span>
            <span className="text-foreground">Research consent</span>
            <span className="block text-[11px] text-muted-foreground">
              Data may be included in anonymised research aggregates.
            </span>
          </span>
          <input
            type="checkbox"
            disabled={busy}
            checked={state.consentResearch}
            onChange={(e) => update({ consentResearch: e.target.checked })}
          />
        </label>
        <label className="flex items-center justify-between gap-3">
          <span>
            <span className="text-foreground">Data sharing consent</span>
            <span className="block text-[11px] text-muted-foreground">
              Records may be shared with affiliated clinicians outside this organization.
            </span>
          </span>
          <input
            type="checkbox"
            disabled={busy}
            checked={state.consentDataSharing}
            onChange={(e) => update({ consentDataSharing: e.target.checked })}
          />
        </label>
        <label className="space-y-1">
          <span className="block text-foreground">Retention until</span>
          <input
            type="date"
            disabled={busy}
            value={state.retentionUntil ? state.retentionUntil.slice(0, 10) : ""}
            onChange={(e) =>
              update({ retentionUntil: e.target.value ? e.target.value : null })
            }
            className="h-9 w-full rounded-md border border-border bg-surface px-3 text-sm text-foreground"
          />
          <span className="block text-[11px] text-muted-foreground">
            When set, the retention sweep auto-archives this patient after the date passes.
          </span>
        </label>
      </CardContent>
    </Card>
  );
}
