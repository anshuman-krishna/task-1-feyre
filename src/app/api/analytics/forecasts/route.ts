import { withErrorHandling } from "@/server/handler";
import { requireAdmin } from "@/server/admin";
import { ok } from "@/lib/api-response";
import { generateAllForecasts } from "@/services/analytics";

export const POST = withErrorHandling(async () => {
  const user = await requireAdmin();
  const payloads = await generateAllForecasts(user.organizationId);
  return ok({ generated: payloads.length });
});
