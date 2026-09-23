import { apiHandler, readJson } from "@/lib/api";
import { PERMISSIONS } from "@/lib/permissions";
import { checkoutSaleOrder } from "@/lib/services/sale-orders";
import { parseId } from "@/lib/validations";

export const POST = apiHandler(
  async (request, { params, session }) => {
    const { id } = await params;
    const body = await readJson(request);
    const saleOrder = await checkoutSaleOrder(parseId(id), body, session);
    return { saleOrder, message: "Baixa realizada. Produto(s) marcados como vendidos." };
  },
  { permission: PERMISSIONS.SALE_CHECKOUT },
);
