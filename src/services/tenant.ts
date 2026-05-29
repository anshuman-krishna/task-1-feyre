// tenant resolver. all create paths funnel through here so there's one
// place to enforce strict scoping. an actor with an organizationId always
// wins; the fallback is the seeded riverside org for boot/seed scripts.

import type { Actor } from "@/services/audit";

const SINGLE_TENANT_FALLBACK = "org_riverside";

export function tenantOf(actor?: Actor): string {
  return actor?.organizationId ?? SINGLE_TENANT_FALLBACK;
}

export function requireTenant(actor?: Actor): string {
  const id = actor?.organizationId;
  if (!id) throw new Error("tenant context required");
  return id;
}
