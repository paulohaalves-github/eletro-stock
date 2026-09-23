import { apiHandler, readJson } from "@/lib/api";
import { PERMISSIONS } from "@/lib/permissions";
import { createSaleOrder, listSaleOrders } from "@/lib/services/sale-orders";

export const GET = apiHandler(
  async (request, { session }) => {
    const { searchParams } = new URL(request.url);
    return listSaleOrders(
      {
        q: searchParams.get("q"),
        status: searchParams.get("status"),
        customerId: searchParams.get("customerId"),
        sellerId: searchParams.get("sellerId"),
        page: searchParams.get("page"),
        pageSize: searchParams.get("pageSize"),
      },
      session,
    );
  },
  { permission: PERMISSIONS.SALE_VIEW },
);

export const POST = apiHandler(
  async (request, { session }) => {
    const body = await readJson(request);
    const saleOrder = await createSaleOrder(body, session);
    return { saleOrder, message: `Venda ${saleOrder.number} aberta.` };
  },
  { permission: PERMISSIONS.SALE_CREATE },
);
