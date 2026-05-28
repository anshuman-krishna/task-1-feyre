import { ok } from "@/lib/api-response";
import { withErrorHandling } from "@/server/handler";
import { getCurrentUser } from "@/server/session";

export const GET = withErrorHandling(async () => {
  const user = await getCurrentUser();
  return ok(
    user
      ? { id: user.id, name: user.name, email: user.email, role: user.role, avatarHue: user.avatarHue }
      : null,
  );
});
