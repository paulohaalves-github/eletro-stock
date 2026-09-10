import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createSessionToken, publicUser, setActiveUnitCookie, setSessionCookie, verifyPassword } from "@/lib/auth";
import { jsonError, unauthorized, validationError } from "@/lib/errors";
import { resolveAllowedUnits } from "@/lib/units";

export async function POST(request) {
  try {
    const body = await request.json();
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    if (!email || !password) throw validationError("Informe e-mail e senha.");

    const user = await prisma.user.findUnique({
      where: { email },
      include: { units: { include: { unit: true } } },
    });
    if (!user || !user.active) throw unauthorized("E-mail ou senha inválidos.");

    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) throw unauthorized("E-mail ou senha inválidos.");

    const units = await resolveAllowedUnits(user);
    const activeUnit = units[0] || null;
    const token = await createSessionToken(user);
    await setSessionCookie(token);
    if (activeUnit) await setActiveUnitCookie(activeUnit.id);

    return NextResponse.json({
      user: publicUser({
        ...user,
        units,
        activeUnit,
        activeUnitId: activeUnit?.id ?? null,
      }),
    });
  } catch (error) {
    return jsonError(error);
  }
}
