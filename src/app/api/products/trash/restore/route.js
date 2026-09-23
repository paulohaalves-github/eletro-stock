import { apiHandler, readJson } from "@/lib/api";
import { PERMISSIONS } from "@/lib/permissions";
import { restoreProductsFromTrash } from "@/lib/services/products";

export const POST = apiHandler(
  async (request, { session }) => {
    const body = await readJson(request);
    return restoreProductsFromTrash(body, session);
  },
  { permission: PERMISSIONS.PRODUCT_TRASH },
);
