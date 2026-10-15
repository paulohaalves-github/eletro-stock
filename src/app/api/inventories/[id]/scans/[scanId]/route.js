import { apiHandler } from "@/lib/api";
import { removeInventoryScan } from "@/lib/services/inventories";

export const DELETE = apiHandler(async (_request, { params, session }) => {
  const { id, scanId } = await params;
  return removeInventoryScan(id, scanId, session);
});
