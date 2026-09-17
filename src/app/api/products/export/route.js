import { apiHandler, readJson } from "@/lib/api";
import { PERMISSIONS } from "@/lib/permissions";
import { exportProductsWorkbook } from "@/lib/services/products";

export const POST = apiHandler(
  async (request, { session }) => {
    const body = await readJson(request);
    const buffer = await exportProductsWorkbook(body, session);
    return new Response(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="estoque.xlsx"',
      },
    });
  },
  { permission: PERMISSIONS.PRODUCT_VIEW },
);
