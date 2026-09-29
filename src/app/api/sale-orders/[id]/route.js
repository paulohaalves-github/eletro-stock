import { apiHandler } from "@/lib/api";
import { PERMISSIONS } from "@/lib/permissions";
import { deleteSaleOrder, getSaleOrder } from "@/lib/services/sale-orders";
import { parseId } from "@/lib/validations";

export const GET = apiHandler(
  async (_request, { params, session }) => {
    const { id } = await params;
    const saleOrder = await getSaleOrder(parseId(id), session);
    return { saleOrder };
  },
  { permission: PERMISSIONS.SALE_VIEW },
);

export const DELETE = apiHandler(
  async (_request, { params, session }) => {
    const { id } = await params;
    await deleteSaleOrder(parseId(id), session);
    return { message: "Venda excluída." };
  },
  { permission: PERMISSIONS.SALE_DELETE },
);
