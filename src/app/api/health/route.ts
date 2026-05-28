import { ok } from "@/lib/api-response";
import { withErrorHandling } from "@/server/handler";

export const dynamic = "force-dynamic";

export const GET = withErrorHandling(async () => {
  return ok({
    status: "ok",
    uptime: process.uptime(),
    env: process.env.NEXT_PUBLIC_APP_ENV ?? "development",
    time: new Date().toISOString(),
  });
});
