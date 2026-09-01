import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createSessionToken, setSessionCookie, verifyPassword } from "@/lib/auth";
import { jsonError, unauthorized, validationError } from "@/lib/errors";
import { publicUser } from "@/lib/auth";

export async function POST(request) {
  try {
    const body = await request.json();
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    if (!email || !password) throw validationError("Informe e-mail e senha.");

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.active) throw unauthorized("E-mail ou senha inválidos.");

    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) throw unauthorized("E-mail ou senha inválidos.");

    const token = await createSessionToken(user);
    await setSessionCookie(token);
    return NextResponse.json({ user: publicUser(user) });
  } catch (error) {
    return jsonError(error);
  }
}
