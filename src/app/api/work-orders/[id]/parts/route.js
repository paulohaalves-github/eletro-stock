import { apiHandler, readJson } from "@/lib/api";
import { PERMISSIONS } from "@/lib/permissions";
import { requestWorkOrderPart } from "@/lib/services/repair";
import { parseId } from "@/lib/validations";

export const POST = apiHandler(
  async (request, { params, session }) => {
    const { id } = await params;
    const body = await readJson(request);
    const workOrder = await requestWorkOrderPart(parseId(id), body, session);
    return { workOrder, message: "Peça solicitada ao estoque." };
  },
  { permission: PERMISSIONS.REPAIR_UPDATE },
);
