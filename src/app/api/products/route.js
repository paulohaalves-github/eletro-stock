import { apiHandler, readJson } from "@/lib/api";
import { PERMISSIONS } from "@/lib/permissions";
import { createProduct, listProducts } from "@/lib/services/products";

export const GET = apiHandler(
  async (request) => {
    const { searchParams } = new URL(request.url);
    return listProducts(Object.fromEntries(searchParams.entries()));
  },
  { permission: PERMISSIONS.PRODUCT_VIEW },
);

export const POST = apiHandler(
  async (request, { session }) => {
    const body = await readJson(request);
    const product = await createProduct(body, session);
    return { product, message: "Entrada de estoque registrada." };
  },
  { permission: PERMISSIONS.STOCK_ENTRY },
);
