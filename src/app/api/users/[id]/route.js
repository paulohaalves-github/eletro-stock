import { apiHandler, readJson } from "@/lib/api";
import { PERMISSIONS } from "@/lib/permissions";
import { updateUser } from "@/lib/services/catalog";
import { parseId } from "@/lib/validations";

export const PATCH = apiHandler(
  async (request, { params, session }) => {
    const { id } = await params;
    const body = await readJson(request);
    const user = await updateUser(parseId(id), body, session);
    return { user, message: "Usuário atualizado." };
  },
  { permission: PERMISSIONS.USER_MANAGE },
);
