import { apiHandler, readJson } from "@/lib/api";
import { PERMISSIONS } from "@/lib/permissions";
import { exitProduct } from "@/lib/services/stock";
import { parseId } from "@/lib/validations";
import { validationError } from "@/lib/errors";

export const POST = apiHandler(
  async (request, { session }) => {
    const body = await readJson(request);
    if (!body.productId) throw validationError("Informe o produto.");
    const product = await exitProduct({
      productId: parseId(body.productId),
      reason: body.reason,
      observation: body.observation,
      user: session,
    });
    return { product, message: "Baixa realizada com sucesso." };
  },
  { permission: PERMISSIONS.STOCK_EXIT },
);
