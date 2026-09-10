import { NextResponse } from "next/server";
import { apiHandler, readJson } from "@/lib/api";
import { publicUser, setActiveUnitCookie } from "@/lib/auth";
import { validationError } from "@/lib/errors";
import { hasUnitAccess } from "@/lib/units";

export const POST = apiHandler(async (request, { session }) => {
  const body = await readJson(request);
  const unitId = Number(body.unitId);
  if (!Number.isInteger(unitId) || unitId <= 0) {
    throw validationError("Informe a unidade.");
  }
  const unit = (session.units || []).find((item) => item.id === unitId);
  if (!unit || !hasUnitAccess(session, unitId)) {
    throw validationError("Você não tem acesso a esta unidade.");
  }
  await setActiveUnitCookie(unit.id);
  return NextResponse.json({
    user: publicUser({ ...session, activeUnit: unit, activeUnitId: unit.id }),
    message: `Unidade alterada para ${unit.name}.`,
  });
});
