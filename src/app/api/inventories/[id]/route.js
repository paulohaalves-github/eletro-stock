import { apiHandler } from "@/lib/api";
import { getInventory } from "@/lib/services/inventories";

export const GET = apiHandler(async (_request, { params, session }) => {
  const { id } = await params;
  return { inventory: await getInventory(id, session) };
});
