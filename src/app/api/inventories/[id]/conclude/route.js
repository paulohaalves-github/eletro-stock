import { apiHandler } from "@/lib/api";
import { concludeInventory } from "@/lib/services/inventories";

export const POST = apiHandler(async (_request, { params, session }) => {
  const { id } = await params;
  const inventory = await concludeInventory(id, session);
  return { inventory, message: `Inventário ${inventory.number} concluído. O estoque do sistema não foi alterado.` };
});
