import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cache } from "react";
import { prisma } from "@/server/prisma";

const COOKIE = "mira_session";
const SECRET = process.env.SESSION_SECRET ?? "dev-only-insecure-secret-replace-in-production";

function sign(value: string) {
  return createHmac("sha256", SECRET).update(value).digest("base64url");
}

function verify(value: string, signature: string) {
  const expected = Buffer.from(sign(value));
  const provided = Buffer.from(signature);
  if (expected.length !== provided.length) return false;
  return timingSafeEqual(expected, provided);
}

export function encodeSession(userId: string) {
  return `${userId}.${sign(userId)}`;
}

export function decodeSession(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const idx = raw.indexOf(".");
  if (idx < 1) return null;
  const userId = raw.slice(0, idx);
  const sig = raw.slice(idx + 1);
  return verify(userId, sig) ? userId : null;
}

// memoized per-request so the db is hit once per server render
export const getCurrentUser = cache(async () => {
  const jar = await cookies();
  const raw = jar.get(COOKIE)?.value;
  const userId = decodeSession(raw);
  if (!userId) return null;
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.archivedAt) return null;
  return user;
});

export async function setSessionCookie(userId: string) {
  const jar = await cookies();
  jar.set(COOKIE, encodeSession(userId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function clearSessionCookie() {
  const jar = await cookies();
  jar.delete(COOKIE);
}

export const SESSION_COOKIE = COOKIE;
