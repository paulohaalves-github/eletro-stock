import { apiHandler } from "@/lib/api";
import { cancelInventory } from "@/lib/services/inventories";

export const POST = apiHandler(async (_request, { params, session }) => {
  const { id } = await params;
  const inventory = await cancelInventory(id, session);
  return { inventory, message: `Inventário ${inventory.number} cancelado. A unidade voltou a movimentar estoque.` };
});
