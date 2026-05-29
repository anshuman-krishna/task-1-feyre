import { prisma } from "@/server/prisma";

// organization access. listMemberships returns the user's home org plus
// any other orgs they've been added to via OrgMembership.

export async function listMembershipsFor(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { organization: true, memberships: { include: { organization: true } } },
  });
  if (!user) return [];

  const seen = new Set<string>();
  const out: { id: string; name: string; slug: string; role: string; home: boolean }[] = [];

  if (user.organization) {
    out.push({
      id: user.organization.id,
      name: user.organization.name,
      slug: user.organization.slug,
      role: user.role,
      home: true,
    });
    seen.add(user.organization.id);
  }
  for (const m of user.memberships) {
    if (seen.has(m.organizationId)) continue;
    out.push({
      id: m.organization.id,
      name: m.organization.name,
      slug: m.organization.slug,
      role: m.role,
      home: false,
    });
    seen.add(m.organizationId);
  }
  return out;
}

export async function getOrganization(id: string) {
  return prisma.organization.findUnique({ where: { id } });
}
