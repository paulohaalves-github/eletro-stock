import { apiHandler, readJson } from "@/lib/api";
import { PERMISSIONS } from "@/lib/permissions";
import { parseProductIds } from "@/lib/validations";
import { validationError } from "@/lib/errors";
import {
  cancelTransfers,
  listTransfers,
  receiveTransfers,
  refuseTransfers,
  sendTransfers,
} from "@/lib/services/stock";

function result(products, message) {
  return { products, product: products[0], message };
}

export const GET = apiHandler(
  async (_request, { session }) => listTransfers(session),
  { permission: PERMISSIONS.STOCK_TRANSFER },
);

export const POST = apiHandler(
  async (request, { session }) => {
    const body = await readJson(request);
    const productIds = parseProductIds(body);
    const count = productIds.length;
    const action = body.action || "send";

    if (action === "send") {
      const products = await sendTransfers({
        productIds,
        toUnitId: body.toUnitId,
        observation: body.observation,
        user: session,
      });
      return result(
        products,
        count === 1
          ? "Produto enviado. A unidade de destino precisa confirmar o recebimento."
          : `${count} produtos enviados. A unidade de destino precisa confirmar o recebimento.`,
      );
    }

    if (action === "receive") {
      const products = await receiveTransfers({
        productIds,
        observation: body.observation,
        user: session,
        locationId: body.locationId,
        locationTypeId: body.locationTypeId,
      });
      return result(
        products,
        count === 1
          ? "Recebimento confirmado. O produto entrou no estoque desta unidade."
          : `${count} produtos recebidos. Eles entraram no estoque desta unidade.`,
      );
    }

    if (action === "cancel") {
      const products = await cancelTransfers({
        productIds,
        observation: body.observation,
        user: session,
      });
      return result(
        products,
        count === 1
          ? "Envio cancelado. O produto voltou ao estoque de origem."
          : `${count} envios cancelados. Os produtos voltaram ao estoque de origem.`,
      );
    }

    if (action === "refuse") {
      const products = await refuseTransfers({
        productIds,
        observation: body.observation,
        user: session,
      });
      return result(
        products,
        count === 1
          ? "Recebimento recusado. O produto voltou à unidade de origem."
          : `${count} recebimentos recusados. Os produtos voltaram à unidade de origem.`,
      );
    }

    throw validationError("Ação de transferência inválida.");
  },
  { permission: PERMISSIONS.STOCK_TRANSFER },
);
