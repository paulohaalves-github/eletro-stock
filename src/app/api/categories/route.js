import { apiHandler, readJson } from "@/lib/api";
import { PERMISSIONS } from "@/lib/permissions";
import { listCategories, upsertCategory } from "@/lib/services/catalog";

export const GET = apiHandler(async (request) => {
  const { searchParams } = new URL(request.url);
  return listCategories({
    q: searchParams.get("q"),
    page: searchParams.get("page"),
    pageSize: searchParams.get("pageSize"),
  });
}, { permission: PERMISSIONS.PRODUCT_VIEW });

export const POST = apiHandler(
  async (request, { session }) => {
    const body = await readJson(request);
    const category = await upsertCategory(body, session);
    return { category, message: "Categoria cadastrada." };
  },
  { permission: PERMISSIONS.CATEGORY_MANAGE },
);
