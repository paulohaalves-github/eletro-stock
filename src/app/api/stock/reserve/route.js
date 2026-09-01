import { apiHandler, readJson } from "@/lib/api";
import { PERMISSIONS } from "@/lib/permissions";
import { reserveProduct, unreserveProduct } from "@/lib/services/stock";
import { parseId } from "@/lib/validations";
import { validationError } from "@/lib/errors";

export const POST = apiHandler(
  async (request, { session }) => {
    const body = await readJson(request);
    if (!body.productId) throw validationError("Informe o produto.");
    const product =
      body.action === "unreserve"
        ? await unreserveProduct(parseId(body.productId), body.observation, session)
        : await reserveProduct(parseId(body.productId), body.observation, session);
    return {
      product,
      message: body.action === "unreserve" ? "Reserva liberada." : "Produto reservado.",
    };
  },
  { permission: PERMISSIONS.STOCK_RESERVE },
);
