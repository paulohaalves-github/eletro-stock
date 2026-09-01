import { apiHandler, readJson } from "@/lib/api";
import { PERMISSIONS } from "@/lib/permissions";
import { listCategories, upsertCategory } from "@/lib/services/catalog";

export const GET = apiHandler(async () => {
  const items = await listCategories();
  return { items };
}, { permission: PERMISSIONS.PRODUCT_VIEW });

export const POST = apiHandler(
  async (request, { session }) => {
    const body = await readJson(request);
    const category = await upsertCategory(body, session);
    return { category, message: "Categoria cadastrada." };
  },
  { permission: PERMISSIONS.CATEGORY_MANAGE },
);
