import { ok } from "@/lib/api-response";
import { withErrorHandling } from "@/server/handler";
import { requireAdmin } from "@/server/admin";
import { listProviders, providerCircuitSnapshot } from "@/services/prediction/providers";
import { listAIProviders } from "@/services/ai";

export const GET = withErrorHandling(async () => {
  await requireAdmin();
  return ok({
    prediction: {
      providers: listProviders(),
      circuits: providerCircuitSnapshot(),
    },
    orchestration: {
      providers: listAIProviders(),
    },
  });
});
