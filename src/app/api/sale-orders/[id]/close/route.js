import { apiHandler, readJson } from "@/lib/api";
import { PERMISSIONS } from "@/lib/permissions";
import { closeSaleOrder } from "@/lib/services/sale-orders";
import { parseId } from "@/lib/validations";

export const POST = apiHandler(
  async (request, { params, session }) => {
    const { id } = await params;
    const body = await readJson(request);
    const saleOrder = await closeSaleOrder(parseId(id), body, session);
    return { saleOrder, message: "Venda encerrada." };
  },
  { permission: PERMISSIONS.SALE_CREATE },
);
