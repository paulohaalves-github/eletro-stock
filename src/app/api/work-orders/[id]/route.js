import { apiHandler, readJson } from "@/lib/api";
import { PERMISSIONS } from "@/lib/permissions";
import { getWorkOrder, updateWorkOrder } from "@/lib/services/repair";
import { parseId } from "@/lib/validations";

export const GET = apiHandler(
  async (_request, { params, session }) => {
    const { id } = await params;
    const workOrder = await getWorkOrder(parseId(id), session);
    return { workOrder };
  },
  { permission: PERMISSIONS.REPAIR_VIEW },
);

export const PATCH = apiHandler(
  async (request, { params, session }) => {
    const { id } = await params;
    const body = await readJson(request);
    const workOrder = await updateWorkOrder(parseId(id), body, session);
    return { workOrder, message: "Ordem de serviço atualizada." };
  },
  { permission: PERMISSIONS.REPAIR_UPDATE },
);
