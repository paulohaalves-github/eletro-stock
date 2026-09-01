import { apiHandler } from "@/lib/api";
import { PERMISSIONS } from "@/lib/permissions";
import { searchProducts } from "@/lib/services/products";

export const GET = apiHandler(
  async (request) => {
    const { searchParams } = new URL(request.url);
    const items = await searchProducts(searchParams.get("q") || "", Number(searchParams.get("limit") || 8));
    return { items };
  },
  { permission: PERMISSIONS.PRODUCT_VIEW },
);
