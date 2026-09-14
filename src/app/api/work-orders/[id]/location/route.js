import { apiHandler, readJson } from "@/lib/api";
import { PERMISSIONS } from "@/lib/permissions";
import { setWorkOrderLocation } from "@/lib/services/repair";
import { parseId } from "@/lib/validations";

export const POST = apiHandler(
  async (request, { params, session }) => {
    const { id } = await params;
    const body = await readJson(request);
    const workOrder = await setWorkOrderLocation(parseId(id), body, session);
    return { workOrder, message: "Localização do aparelho atualizada." };
  },
  { permission: PERMISSIONS.REPAIR_UPDATE },
);
