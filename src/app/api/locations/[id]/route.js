import { apiHandler, readJson } from "@/lib/api";
import { PERMISSIONS } from "@/lib/permissions";
import { deleteLocation, updateLocation } from "@/lib/services/locations";
import { parseId } from "@/lib/validations";

export const PATCH = apiHandler(
  async (request, { params, session }) => {
    const { id } = await params;
    const body = await readJson(request);
    const item = await updateLocation(parseId(id), body, session);
    return { item, message: "Localização atualizada." };
  },
  { permission: PERMISSIONS.LOCATION_MANAGE },
);

export const DELETE = apiHandler(
  async (_request, { params, session }) => {
    const { id } = await params;
    await deleteLocation(parseId(id), session);
    return { message: "Localização excluída." };
  },
  { permission: PERMISSIONS.LOCATION_MANAGE },
);
