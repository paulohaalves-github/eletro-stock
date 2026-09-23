import { apiHandler, readJson } from "@/lib/api";
import { PERMISSIONS } from "@/lib/permissions";
import { addSaleOrderNote } from "@/lib/services/sale-orders";
import { parseId } from "@/lib/validations";

export const POST = apiHandler(
  async (request, { params, session }) => {
    const { id } = await params;
    const body = await readJson(request);
    const saleOrder = await addSaleOrderNote(parseId(id), body.message, session);
    return { saleOrder, message: "Comentário registrado." };
  },
  { permission: PERMISSIONS.SALE_CREATE },
);
