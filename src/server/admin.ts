import { ApiError } from "@/lib/api-error";
import { getCurrentUser } from "./session";

// admin gate. used by /admin pages and admin-only API routes. role check
// runs against the user's currently-active org role (the session resolver
// already swaps role to the membership role when the user is acting in
// a non-home organization).
export async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user) throw new ApiError("unauthorized", 401, "unauthorized");
  if (user.role !== "admin") throw new ApiError("admin required", 403, "forbidden");
  return user;
}
