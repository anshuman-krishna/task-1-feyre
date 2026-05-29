"use client";

import { useState } from "react";
import { toast } from "sonner";
import Link from "next/link";
import { RotateCcw } from "lucide-react";
import { fetcher } from "@/lib/fetcher";
import { Button } from "@/components/ui/button";

type Job = {
  id: string;
  status: string;
  attempts: number;
  maxAttempts: number;
  provider: string | null;
  error: string | null;
  patientId: string | null;
  patientName: string | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
};

const statusTone: Record<string, string> = {
  queued: "bg-amber-50 text-amber-800",
  processing: "bg-accent text-accent-foreground",
  completed: "bg-emerald-50 text-emerald-700",
  failed: "bg-orange-50 text-orange-800",
  dead: "bg-red-50 text-red-700",
};

export function QueueAdminClient({ jobs }: { jobs: Job[] }) {
  const [busy, setBusy] = useState<string | null>(null);

  const onRetry = async (id: string) => {
    setBusy(id);
    try {
      await fetcher(`/api/admin/queue/retry`, {
        method: "POST",
        body: JSON.stringify({ jobId: id }),
      });
      toast.success("Job requeued");
    } catch (err) {
      toast.error("Could not retry job", {
        description: err instanceof Error ? err.message : "unknown error",
      });
    } finally {
      setBusy(null);
    }
  };

  if (jobs.length === 0) return <p className="text-sm text-muted-foreground">No jobs.</p>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead className="text-[10px] uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="py-1 text-left font-medium">Status</th>
            <th className="py-1 text-left font-medium">Patient</th>
            <th className="py-1 text-left font-medium">Provider</th>
            <th className="py-1 text-right font-medium">Attempts</th>
            <th className="py-1 text-left font-medium">Created</th>
            <th className="py-1 text-left font-medium">Error</th>
            <th />
          </tr>
        </thead>
        <tbody className="divide-y divide-border text-foreground">
          {jobs.map((j) => (
            <tr key={j.id}>
              <td className="py-1.5">
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-medium capitalize ${statusTone[j.status] ?? "bg-muted text-muted-foreground"}`}
                >
                  {j.status}
                </span>
              </td>
              <td className="py-1.5">
                {j.patientId ? (
                  <Link href={`/patients/${j.patientId}`} className="hover:underline">
                    {j.patientName}
                  </Link>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </td>
              <td className="py-1.5">{j.provider ?? "—"}</td>
              <td className="py-1.5 text-right font-mono">
                {j.attempts}/{j.maxAttempts}
              </td>
              <td className="py-1.5 text-muted-foreground">{j.createdAt}</td>
              <td className="py-1.5 text-muted-foreground">
                {j.error ? <span className="line-clamp-1 max-w-xs">{j.error}</span> : "—"}
              </td>
              <td className="py-1.5">
                {(j.status === "dead" || j.status === "failed") && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onRetry(j.id)}
                    disabled={busy === j.id}
                  >
                    <RotateCcw className="h-3 w-3" /> Retry
                  </Button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
