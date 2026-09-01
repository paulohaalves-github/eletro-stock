import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { cache } from "react";
import bcrypt from "bcryptjs";
import { prisma } from "./db";
import { SESSION_COOKIE, SESSION_MAX_AGE } from "./constants";
import { unauthorized, forbidden } from "./errors";
import { can } from "./permissions";

function getSecret() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET não configurado.");
  }
  return new TextEncoder().encode(secret);
}

export async function hashPassword(password) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

export async function createSessionToken(user) {
  return new SignJWT({
    sub: String(user.id),
    email: user.email,
    name: user.name,
    role: user.role,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(getSecret());
}

export async function verifySessionToken(token) {
  const { payload } = await jwtVerify(token, getSecret());
  return payload;
}

export async function setSessionCookie(token) {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

export const getSession = cache(async () => {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  try {
    const payload = await verifySessionToken(token);
    const user = await prisma.user.findUnique({
      where: { id: Number(payload.sub) },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        active: true,
      },
    });

    if (!user || !user.active) return null;
    return user;
  } catch {
    return null;
  }
});

export async function requireAuth() {
  const session = await getSession();
  if (!session) throw unauthorized();
  return session;
}

export async function requirePermission(permission) {
  const session = await requireAuth();
  if (!can(session.role, permission)) throw forbidden();
  return session;
}

export function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    active: user.active !== false,
  };
}
