import { apiHandler } from "@/lib/api";
import { PERMISSIONS } from "@/lib/permissions";
import { generateSaleOrder } from "@/lib/services/sale-orders";
import { parseId } from "@/lib/validations";

export const POST = apiHandler(
  async (_request, { params, session }) => {
    const { id } = await params;
    const saleOrder = await generateSaleOrder(parseId(id), session);
    return { saleOrder, message: "Pedido de venda gerado. Encaminhe ao caixa para a baixa." };
  },
  { permission: PERMISSIONS.SALE_CREATE },
);
