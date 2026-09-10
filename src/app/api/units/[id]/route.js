import { apiHandler, readJson } from "@/lib/api";
import { PERMISSIONS } from "@/lib/permissions";
import { parseId } from "@/lib/validations";
import { updateUnit } from "@/lib/units";

export const PATCH = apiHandler(
  async (request, { params, session }) => {
    const { id } = await params;
    const body = await readJson(request);
    const unit = await updateUnit(parseId(id), body, session);
    return { unit, message: "Unidade atualizada." };
  },
  { permission: PERMISSIONS.UNIT_MANAGE },
);
