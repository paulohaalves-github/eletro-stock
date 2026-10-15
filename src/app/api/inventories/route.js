import { apiHandler, readJson } from "@/lib/api";
import { createInventory, listInventories } from "@/lib/services/inventories";

export const GET = apiHandler(async (_request, { session }) => listInventories(session));

export const POST = apiHandler(async (request, { session }) => {
  const body = await readJson(request);
  const inventory = await createInventory(body, session);
  return { inventory, message: `Inventário ${inventory.number} aberto. O estoque da unidade fica bloqueado até a conclusão.` };
});
