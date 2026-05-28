import { prisma } from "@/server/prisma";

export async function listUsers() {
  return prisma.user.findMany({
    where: { archivedAt: null },
    orderBy: [{ role: "asc" }, { name: "asc" }],
  });
}

export async function getUser(id: string) {
  return prisma.user.findUnique({ where: { id } });
}

export async function listClinicians() {
  return prisma.user.findMany({
    where: { archivedAt: null, role: { in: ["clinician", "admin"] } },
    orderBy: { name: "asc" },
    select: { id: true, name: true, role: true, avatarHue: true },
  });
}
