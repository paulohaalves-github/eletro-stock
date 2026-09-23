import { apiHandler, readJson } from "@/lib/api";
import { PERMISSIONS } from "@/lib/permissions";
import { listTrashedProducts, moveProductsToTrash } from "@/lib/services/products";

export const GET = apiHandler(
  async (request, { session }) => {
    const { searchParams } = new URL(request.url);
    return listTrashedProducts(Object.fromEntries(searchParams.entries()), session);
  },
  { permission: PERMISSIONS.PRODUCT_TRASH },
);

export const POST = apiHandler(
  async (request, { session }) => {
    const body = await readJson(request);
    return moveProductsToTrash(body, session);
  },
  { permission: PERMISSIONS.PRODUCT_TRASH },
);
