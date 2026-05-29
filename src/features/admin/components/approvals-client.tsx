"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fetcher } from "@/lib/fetcher";

type Row = {
  id: string;
  kind: string;
  state: string;
  targetType: string;
  targetId: string;
  patient: { id: string; fullName: string } | null;
  requester: string | null;
  decider: string | null;
  requestedReason: string | null;
  decisionReason: string | null;
  createdAt: string;
  decidedAt: string | null;
};

const stateTone: Record<string, string> = {
  pending: "bg-amber-50 text-amber-800",
  approved: "bg-emerald-50 text-emerald-700",
  rejected: "bg-red-50 text-red-700",
  withdrawn: "bg-muted text-muted-foreground",
};

export function ApprovalsClient({ rows }: { rows: Row[] }) {
  const [state, setState] = useState(rows);
  const [busy, setBusy] = useState<string | null>(null);

  const onDecide = async (id: string, decision: "approved" | "rejected") => {
    setBusy(id);
    try {
      await fetcher(`/api/admin/approvals/${id}`, {
        method: "POST",
        body: JSON.stringify({ decision }),
      });
      setState((s) =>
        s.map((r) =>
          r.id === id ? { ...r, state: decision, decidedAt: new Date().toISOString() } : r,
        ),
      );
      toast.success(`Approval ${decision}`);
    } catch (err) {
      toast.error("Decision failed", {
        description: err instanceof Error ? err.message : "unknown",
      });
    } finally {
      setBusy(null);
    }
  };

  if (state.length === 0) return <p className="text-sm text-muted-foreground">No approvals.</p>;

  return (
    <ul className="divide-y divide-border">
      {state.map((r) => (
        <li key={r.id} className="space-y-1 py-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground">
                {r.kind.replace(/_/g, " ")}
                {r.patient && (
                  <>
                    {" — "}
                    <Link href={`/patients/${r.patient.id}`} className="hover:underline">
                      {r.patient.fullName}
                    </Link>
                  </>
                )}
              </p>
              <p className="text-xs text-muted-foreground">
                {r.targetType}#{r.targetId.slice(0, 10)} · requested by {r.requester ?? "system"} · {r.createdAt}
              </p>
              {r.requestedReason && (
                <p className="mt-0.5 text-xs italic text-muted-foreground">{r.requestedReason}</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-medium capitalize ${
                  stateTone[r.state] ?? "bg-muted text-muted-foreground"
                }`}
              >
                {r.state}
              </span>
              {r.state === "pending" && (
                <>
                  <Button
                    size="sm"
                    onClick={() => onDecide(r.id, "approved")}
                    disabled={busy === r.id}
                  >
                    <Check className="h-3 w-3" /> Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onDecide(r.id, "rejected")}
                    disabled={busy === r.id}
                  >
                    <X className="h-3 w-3" /> Reject
                  </Button>
                </>
              )}
            </div>
          </div>
          {r.decider && (
            <p className="text-[10px] text-muted-foreground">
              {r.state} by {r.decider}
              {r.decidedAt ? ` · ${r.decidedAt}` : ""}
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}
