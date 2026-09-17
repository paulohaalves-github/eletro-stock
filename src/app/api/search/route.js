import { apiHandler } from "@/lib/api";
import { PERMISSIONS } from "@/lib/permissions";
import { searchProducts } from "@/lib/services/products";

export const GET = apiHandler(
  async (request, { session }) => {
    const { searchParams } = new URL(request.url);
    return searchProducts(
      searchParams.get("q") || "",
      {
        limit: Number(searchParams.get("pageSize") || searchParams.get("limit") || 50),
        page: Number(searchParams.get("page") || 1),
      },
      session,
    );
  },
  { permission: PERMISSIONS.PRODUCT_VIEW },
);
