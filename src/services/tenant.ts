// soft tenant resolver. all create paths funnel through here so they have
// one place to harden when multi-tenant becomes strict. for now we have a
// single seeded org as the fallback.

import type { Actor } from "@/services/audit";

const SINGLE_TENANT_FALLBACK = "org_riverside";

export function tenantOf(actor?: Actor): string {
  return actor?.organizationId ?? SINGLE_TENANT_FALLBACK;
}
