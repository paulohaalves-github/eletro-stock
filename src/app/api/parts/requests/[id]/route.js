import { apiHandler, readJson } from "@/lib/api";
import { PERMISSIONS } from "@/lib/permissions";
import { fulfillWorkOrderPart, refuseWorkOrderPart } from "@/lib/services/parts";
import { parseId } from "@/lib/validations";
import { validationError } from "@/lib/errors";

export const POST = apiHandler(
  async (request, { params, session }) => {
    const { id } = await params;
    const body = await readJson(request);
    if (body.action === "refuse") {
      const result = await refuseWorkOrderPart(parseId(id), body, session);
      return result;
    }
    if (body.action && body.action !== "fulfill") {
      throw validationError("Ação inválida.");
    }
    const result = await fulfillWorkOrderPart(parseId(id), body, session);
    return result;
  },
  { permission: PERMISSIONS.PART_STOCK },
);
