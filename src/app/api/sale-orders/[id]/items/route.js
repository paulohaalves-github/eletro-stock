import { apiHandler, readJson } from "@/lib/api";
import { PERMISSIONS } from "@/lib/permissions";
import {
  addSaleOrderItem,
  removeSaleOrderItem,
  reserveSaleOrderItem,
  unreserveSaleOrderItem,
} from "@/lib/services/sale-orders";
import { parseId } from "@/lib/validations";
import { validationError } from "@/lib/errors";

export const POST = apiHandler(
  async (request, { params, session }) => {
    const { id } = await params;
    const body = await readJson(request);
    if (!body.productId) throw validationError("Informe o produto.");
    const saleOrder = await addSaleOrderItem(parseId(id), parseId(body.productId), session);
    return { saleOrder, message: "Produto incluído na venda." };
  },
  { permission: PERMISSIONS.SALE_CREATE },
);

export const PATCH = apiHandler(
  async (request, { params, session }) => {
    const { id } = await params;
    const body = await readJson(request);
    const itemId = parseId(body.itemId);
    const action = String(body.action || "");
    let saleOrder;
    let message = "Venda atualizada.";
    if (action === "reserve") {
      saleOrder = await reserveSaleOrderItem(parseId(id), itemId, body.reservedUntil, session);
      message = "Produto reservado.";
    } else if (action === "unreserve") {
      saleOrder = await unreserveSaleOrderItem(parseId(id), itemId, session);
      message = "Reserva liberada.";
    } else if (action === "remove") {
      saleOrder = await removeSaleOrderItem(parseId(id), itemId, session);
      message = "Produto removido da venda.";
    } else {
      throw validationError("Informe uma ação válida.");
    }
    return { saleOrder, message };
  },
  { permission: PERMISSIONS.SALE_CREATE },
);
