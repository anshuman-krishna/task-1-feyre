import type { NextRequest } from "next/server";
import { z } from "zod";
import { ok } from "@/lib/api-response";
import { BadRequest } from "@/lib/api-error";
import { withErrorHandling } from "@/server/handler";
import { requireAdmin } from "@/server/admin";
import { retryJob } from "@/services/queue/admin";

const Schema = z.object({ jobId: z.string().min(1) });

export const POST = withErrorHandling(async (req: NextRequest) => {
  const user = await requireAdmin();
  const body = await req.json().catch(() => ({}));
  const parsed = Schema.safeParse(body);
  if (!parsed.success) throw BadRequest("invalid payload");
  const job = await retryJob(parsed.data.jobId, {
    id: user.id,
    name: user.name,
    organizationId: user.organizationId,
  });
  return ok(job);
});
