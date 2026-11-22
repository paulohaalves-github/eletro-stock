import { apiHandler } from "@/lib/api";
import { PERMISSIONS } from "@/lib/permissions";
import { listSaleAttendants } from "@/lib/services/sale-orders";

export const GET = apiHandler(
  async (_request, { session }) => {
    const items = await listSaleAttendants(session);
    return { items };
  },
  { permission: PERMISSIONS.SALE_VIEW },
);
