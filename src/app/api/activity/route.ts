import type { NextRequest } from "next/server";
import { ok } from "@/lib/api-response";
import { withErrorHandling } from "@/server/handler";
import { listActivity } from "@/services/activity";

export const GET = withErrorHandling(async (req: NextRequest) => {
  const limit = Number(req.nextUrl.searchParams.get("limit") ?? "20");
  const rows = await listActivity(Math.min(100, Math.max(1, limit)));
  return ok(rows);
});
