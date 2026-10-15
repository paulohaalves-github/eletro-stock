import { apiHandler, readJson } from "@/lib/api";
import { scanInventory } from "@/lib/services/inventories";

export const POST = apiHandler(async (request, { params, session }) => {
  const { id } = await params;
  const body = await readJson(request);
  return scanInventory(id, body, session);
});
