import { apiHandler } from "@/lib/api";
import { PERMISSIONS } from "@/lib/permissions";
import { revertSaleOrderToReserved } from "@/lib/services/sale-orders";
import { parseId } from "@/lib/validations";

export const POST = apiHandler(
  async (_request, { params, session }) => {
    const { id } = await params;
    const saleOrder = await revertSaleOrderToReserved(parseId(id), session);
    return { message: "Venda retroagida para reservada.", saleOrder };
  },
  { permission: PERMISSIONS.SALE_DELETE },
);
