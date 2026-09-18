import { apiHandler, readJson } from "@/lib/api";
import { PERMISSIONS } from "@/lib/permissions";
import { isStockRepair } from "@/lib/constants";
import { deliverWorkOrder } from "@/lib/services/repair";
import { parseId } from "@/lib/validations";

export const POST = apiHandler(
  async (request, { params, session }) => {
    const { id } = await params;
    const body = await readJson(request);
    const workOrder = await deliverWorkOrder(parseId(id), body, session);
    return {
      workOrder,
      message: isStockRepair(workOrder)
        ? "Produto devolvido ao estoque."
        : "Produto devolvido ao cliente.",
    };
  },
  { permission: PERMISSIONS.REPAIR_UPDATE },
);
