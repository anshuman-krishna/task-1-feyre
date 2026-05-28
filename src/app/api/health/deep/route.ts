import { ok } from "@/lib/api-response";
import { withErrorHandling } from "@/server/handler";
import { deepHealth } from "@/server/health";

export const dynamic = "force-dynamic";

export const GET = withErrorHandling(async () => {
  const result = await deepHealth();
  return ok(result);
});
