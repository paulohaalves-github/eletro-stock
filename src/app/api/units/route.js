import { apiHandler, readJson } from "@/lib/api";
import { PERMISSIONS, can } from "@/lib/permissions";
import { createUnit, listActiveUnits, listUnits } from "@/lib/units";
import { UNIT_TYPE_LABELS } from "@/lib/constants";

export const GET = apiHandler(async (request, { session }) => {
  const { searchParams } = new URL(request.url);
  const all = searchParams.get("all") === "1";
  if (all && can(session.role, PERMISSIONS.UNIT_MANAGE)) {
    return listUnits({
      includeInactive: true,
      q: searchParams.get("q"),
      page: searchParams.get("page"),
      pageSize: searchParams.get("pageSize"),
    });
  }
  const items = await listActiveUnits();
  return { items, total: items.length };
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
