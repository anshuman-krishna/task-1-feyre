import type { NextRequest } from "next/server";
import { ok } from "@/lib/api-response";
import { Unauthorized } from "@/lib/api-error";
import { withErrorHandling } from "@/server/handler";
import { getCurrentUser } from "@/server/session";
import { searchClient } from "@/services/search";

export const GET = withErrorHandling(async (req: NextRequest) => {
  const user = await getCurrentUser();
  if (!user) throw Unauthorized();
  const url = new URL(req.url);
  const q = url.searchParams.get("q") ?? "";
  const limit = Math.min(20, Number(url.searchParams.get("limit") ?? 12) || 12);
  const hits = await searchClient.search(q, {
    organizationId: user.organizationId,
    limit,
  });
  return ok({ query: q, hits });
});
