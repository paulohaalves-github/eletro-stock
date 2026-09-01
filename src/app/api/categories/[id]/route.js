import { apiHandler, readJson } from "@/lib/api";
import { PERMISSIONS } from "@/lib/permissions";
import { upsertCategory } from "@/lib/services/catalog";
import { parseId } from "@/lib/validations";

export const PATCH = apiHandler(
  async (request, { params, session }) => {
    const { id } = await params;
    const body = await readJson(request);
    const category = await upsertCategory(body, session, parseId(id));
    return { category, message: "Categoria atualizada." };
  },
  { permission: PERMISSIONS.CATEGORY_MANAGE },
);
