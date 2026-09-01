import { apiHandler } from "@/lib/api";
import { PERMISSIONS } from "@/lib/permissions";
import { findCatalogModel, listCatalogModels } from "@/lib/services/catalog-models";

export const GET = apiHandler(
  async (request) => {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");
    if (code) {
      const item = await findCatalogModel(code);
      return { item };
    }
    const items = await listCatalogModels(searchParams.get("q") || "");
    return { items };
  },
  { permission: PERMISSIONS.PRODUCT_VIEW },
);
