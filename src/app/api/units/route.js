import { apiHandler, readJson } from "@/lib/api";
import { PERMISSIONS, can } from "@/lib/permissions";
import { createUnit, listActiveUnits, listUnits } from "@/lib/units";
import { UNIT_TYPE_LABELS } from "@/lib/constants";

export const GET = apiHandler(async (request, { session }) => {
  const { searchParams } = new URL(request.url);
  const all = searchParams.get("all") === "1";
  const items = all && can(session.role, PERMISSIONS.UNIT_MANAGE)
    ? await listUnits({ includeInactive: true })
    : await listActiveUnits();
  return { items };
});

export const POST = apiHandler(
  async (request, { session }) => {
    const body = await readJson(request);
    const unit = await createUnit(body, session);
    const kind = UNIT_TYPE_LABELS[unit.type] || "Unidade";
    return { unit, message: `${kind} cadastrada.` };
  },
  { permission: PERMISSIONS.UNIT_MANAGE },
);
