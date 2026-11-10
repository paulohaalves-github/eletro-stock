import { apiHandler } from "@/lib/api";
import { PERMISSIONS } from "@/lib/permissions";
import { cancelSaleOrder, getSaleOrder, updateSaleOrderSoldAt } from "@/lib/services/sale-orders";
import { parseId } from "@/lib/validations";

export const GET = apiHandler(
  async (_request, { params, session }) => {
    const { id } = await params;
    const saleOrder = await getSaleOrder(parseId(id), session);
    return { saleOrder };
  },
  { permission: PERMISSIONS.SALE_VIEW },
);

export const PATCH = apiHandler(
  async (request, { params, session }) => {
    const { id } = await params;
    const body = await request.json();
    if (body.soldAt === undefined) {
      return { message: "Nenhuma alteração informada.", saleOrder: await getSaleOrder(parseId(id), session) };
    }
    const saleOrder = await updateSaleOrderSoldAt(parseId(id), body.soldAt, session);
    return { message: "Data da venda atualizada.", saleOrder };
  },
  { permission: PERMISSIONS.SALE_CHECKOUT },
);

export const DELETE = apiHandler(
  async (_request, { params, session }) => {
    const { id } = await params;
    const saleOrder = await cancelSaleOrder(parseId(id), session);
    return { message: "Venda cancelada.", saleOrder };
  },
  { permission: PERMISSIONS.SALE_DELETE },
);
