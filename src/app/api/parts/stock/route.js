import { apiHandler, readJson } from "@/lib/api";
import { PERMISSIONS } from "@/lib/permissions";
import { enterPartStock, movePartLocation } from "@/lib/services/parts";
import { validationError } from "@/lib/errors";

export const POST = apiHandler(
  async (request, { session }) => {
    const body = await readJson(request);
    if (body.action === "move") {
      const part = await movePartLocation(body, session);
      return { part, message: "Peças movimentadas de localização." };
    }
    if (body.action && body.action !== "entry") {
      throw validationError("Ação inválida.");
    }
    const part = await enterPartStock(body, session);
    return { part, message: "Entrada de peças registrada." };
  },
  { permission: PERMISSIONS.PART_STOCK },
);
