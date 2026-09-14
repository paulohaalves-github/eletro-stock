import { apiHandler, readJson } from "@/lib/api";
import { PERMISSIONS } from "@/lib/permissions";
import { cancelOrRefusePartTransfer, receivePartTransfer } from "@/lib/services/parts";
import { parseId } from "@/lib/validations";
import { validationError } from "@/lib/errors";

export const POST = apiHandler(
  async (request, { params, session }) => {
    const { id } = await params;
    const body = await readJson(request);
    const action = body.action || "receive";
    if (action === "receive") {
      const part = await receivePartTransfer(parseId(id), body, session);
      return { part, message: "Peças recebidas no estoque." };
    }
    if (action === "cancel" || action === "refuse") {
      const result = await cancelOrRefusePartTransfer(parseId(id), { action, observation: body.observation }, session);
      return result;
    }
    throw validationError("Ação inválida.");
  },
  { permission: PERMISSIONS.PART_STOCK },
);
