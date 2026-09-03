import { apiHandler, readJson } from "@/lib/api";
import { PERMISSIONS } from "@/lib/permissions";
import { deleteLocationType, updateLocationType } from "@/lib/services/locations";
import { parseId } from "@/lib/validations";

export const PATCH = apiHandler(
  async (request, { params, session }) => {
    const { id } = await params;
    const body = await readJson(request);
    const item = await updateLocationType(parseId(id), body, session);
    return { item, message: "Tipo de localização atualizado." };
  },
  { permission: PERMISSIONS.LOCATION_MANAGE },
);

export const DELETE = apiHandler(
  async (_request, { params, session }) => {
    const { id } = await params;
    await deleteLocationType(parseId(id), session);
    return { message: "Tipo de localização excluído." };
  },
  { permission: PERMISSIONS.LOCATION_MANAGE },
);
