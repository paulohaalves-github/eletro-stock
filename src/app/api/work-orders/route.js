import { apiHandler, readJson } from "@/lib/api";
import { PERMISSIONS } from "@/lib/permissions";
import { createWorkOrder, listWorkOrders, lookupSoldProduct } from "@/lib/services/repair";

export const GET = apiHandler(
  async (request, { session }) => {
    const { searchParams } = new URL(request.url);
    if (searchParams.get("lookup")) {
      const items = await lookupSoldProduct(searchParams.get("q") || searchParams.get("lookup"), session);
      return { items };
    }
    return listWorkOrders(
      {
        q: searchParams.get("q"),
        status: searchParams.get("status"),
        servicePlace: searchParams.get("servicePlace"),
        page: searchParams.get("page"),
        pageSize: searchParams.get("pageSize"),
      },
      session,
    );
  },
  { permission: PERMISSIONS.REPAIR_VIEW },
);

export const POST = apiHandler(
  async (request, { session }) => {
    const body = await readJson(request);
    const workOrder = await createWorkOrder(body, session);
    return { workOrder, message: `Ordem ${workOrder.number} aberta.` };
  },
  { permission: PERMISSIONS.REPAIR_CREATE },
);
