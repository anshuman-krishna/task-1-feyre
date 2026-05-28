import { ok } from "@/lib/api-response";
import { withErrorHandling } from "@/server/handler";
import { listUsers } from "@/services/user";

export const GET = withErrorHandling(async () => {
  const users = await listUsers();
  return ok(users.map((u) => ({ id: u.id, name: u.name, role: u.role, avatarHue: u.avatarHue })));
});
