import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { jobCountsByStatus, listJobs } from "@/services/queue/admin";
import { formatDateTime } from "@/lib/format";
import { QueueAdminClient } from "@/features/admin/components/queue-client";

export const dynamic = "force-dynamic";

export default async function AdminQueuePage() {
  const [counts, jobs] = await Promise.all([jobCountsByStatus(), listJobs({ limit: 40 })]);

  return (
    <div className="space-y-4">
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {(["queued", "processing", "completed", "failed", "dead"] as const).map((s) => (
          <div key={s} className="rounded-md border border-border bg-surface p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {s}
            </p>
            <p className="text-lg font-semibold text-foreground">{counts[s]}</p>
          </div>
        ))}
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Recent jobs</CardTitle>
          <CardDescription>
            Click <em>retry</em> on a failed or dead-letter job to reset attempts and reschedule it.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <QueueAdminClient
            jobs={jobs.map((j) => ({
              id: j.id,
              status: j.status,
              attempts: j.attempts,
              maxAttempts: j.maxAttempts,
              provider: j.provider,
              error: j.error,
              patientName: j.patient?.fullName ?? null,
              patientId: j.patient?.id ?? null,
              createdAt: formatDateTime(j.createdAt),
              startedAt: j.startedAt ? formatDateTime(j.startedAt) : null,
              completedAt: j.completedAt ? formatDateTime(j.completedAt) : null,
            }))}
          />
        </CardContent>
      </Card>
    </div>
  );
}
