import { prisma } from "./db";
import { INVENTORY_STATUSES } from "./constants";
import { conflict } from "./errors";

export async function assertNoOpenInventory(unitIds) {
  const ids = [...new Set((Array.isArray(unitIds) ? unitIds : [unitIds])
    .map((id) => Number(id))
    .filter((id) => Number.isInteger(id) && id > 0))];
  if (!ids.length) return;

  const open = await prisma.inventoryCount.findFirst({
    where: { unitId: { in: ids }, status: INVENTORY_STATUSES.OPEN },
    select: { number: true, unit: { select: { name: true } } },
  });
  if (!open) return;

  throw conflict(
    `A unidade ${open.unit.name} está com o inventário ${open.number} aberto. Conclua ou cancele o inventário antes de movimentar o estoque.`,
  );
}
