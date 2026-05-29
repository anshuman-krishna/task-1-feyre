import type { NextRequest } from "next/server";
import type { PredictionJobStatus } from "@prisma/client";
import { ok } from "@/lib/api-response";
import { withErrorHandling } from "@/server/handler";
import { requireAdmin } from "@/server/admin";
import { listJobs, jobCountsByStatus } from "@/services/queue/admin";

export const GET = withErrorHandling(async (req: NextRequest) => {
  await requireAdmin();
  const url = new URL(req.url);
  const status = url.searchParams.get("status") as PredictionJobStatus | null;
  const [jobs, counts] = await Promise.all([
    listJobs({ status: status ?? undefined, limit: 40 }),
    jobCountsByStatus(),
  ]);
  return ok({ jobs, counts });
});
