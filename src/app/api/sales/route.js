import { apiHandler, readJson } from "@/lib/api";
import { PERMISSIONS } from "@/lib/permissions";
import { createSale } from "@/lib/services/sales";

export const POST = apiHandler(
  async (request, { session }) => {
    const body = await readJson(request);
    const sale = await createSale({ ...body, user: session });
    return { sale, message: "Venda vinculada ao produto." };
  },
  { permission: PERMISSIONS.STOCK_EXIT },
);
