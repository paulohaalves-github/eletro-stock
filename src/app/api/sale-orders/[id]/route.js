import { apiHandler } from "@/lib/api";
import { PERMISSIONS } from "@/lib/permissions";
import { getSaleOrder } from "@/lib/services/sale-orders";
import { parseId } from "@/lib/validations";

export const GET = apiHandler(
  async (_request, { params, session }) => {
    const { id } = await params;
    const saleOrder = await getSaleOrder(parseId(id), session);
    return { saleOrder };
  },
  { permission: PERMISSIONS.SALE_VIEW },
);
