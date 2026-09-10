import { prisma } from "../db";
import { PRICE_RANGES, STATUSES } from "../constants";
import { periodRange } from "../format";
import { requireActiveUnit, serializeUnit } from "../units";

const IN_STOCK = [STATUSES.AVAILABLE, STATUSES.RESERVED];
const ENTRY_TYPES = ["ENTRADA", "TRANSFERENCIA_RECEBIMENTO"];
const EXIT_TYPES = ["SAIDA", "TRANSFERENCIA", "TRANSFERENCIA_ENVIO"];

export async function getDashboard(period = "30d", from, to, session) {
  const range = periodRange(period, from, to);
  const unitId = requireActiveUnit(session);
  const unitWhere = { unitId };

  const [
    byStatus,
    byCategory,
    byCondition,
    inStockProducts,
    incomingCount,
    recentEntries,
    recentExits,
    movements,
  ] = await Promise.all([
    prisma.product.groupBy({ by: ["status"], where: unitWhere, _count: { _all: true } }),
    prisma.product.groupBy({
      by: ["categoryId"],
      where: { ...unitWhere, status: { in: IN_STOCK } },
      _count: { _all: true },
    }),
    prisma.product.groupBy({
      by: ["condition"],
      where: { ...unitWhere, status: { in: IN_STOCK } },
      _count: { _all: true },
    }),
    prisma.product.findMany({
      where: { ...unitWhere, status: { in: IN_STOCK } },
      select: { cashPrice: true, installmentPrice: true, marketPrice: true, status: true },
    }),
    prisma.product.count({
      where: { transferToUnitId: unitId, status: STATUSES.IN_TRANSIT },
    }),
    prisma.stockMovement.findMany({
      where: { type: { in: ENTRY_TYPES }, newUnitId: unitId },
      include: {
        product: { include: { category: true, images: { where: { isPrimary: true }, take: 1 } } },
        user: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
    prisma.stockMovement.findMany({
      where: { type: { in: EXIT_TYPES }, previousUnitId: unitId },
      include: {
        product: { include: { category: true, images: { where: { isPrimary: true }, take: 1 } } },
        user: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
    prisma.stockMovement.findMany({
      where: {
        createdAt: { gte: range.start, lte: range.end },
        type: { in: [...ENTRY_TYPES, ...EXIT_TYPES] },
        OR: [{ previousUnitId: unitId }, { newUnitId: unitId }],
      },
      select: { type: true, createdAt: true, previousUnitId: true, newUnitId: true },
    }),
  ]);

  const statusMap = Object.fromEntries(byStatus.map((row) => [row.status, row._count._all]));
  const available = statusMap.DISPONIVEL || 0;
  const reserved = statusMap.RESERVADO || 0;
  const sold = statusMap.VENDIDO || 0;
  const inTransit = statusMap.EM_TRANSITO || 0;
  const inStock = available + reserved;

  const totals = inStockProducts.reduce(
    (acc, product) => {
      acc.cash += product.cashPrice || 0;
      acc.installment += product.installmentPrice || 0;
      acc.market += product.marketPrice || 0;
      return acc;
    },
    { cash: 0, installment: 0, market: 0 },
  );

  const categories = await prisma.category.findMany();
  const categoryMap = Object.fromEntries(categories.map((item) => [item.id, item.name]));
  const categoryChart = byCategory.map((row) => ({
    name: categoryMap[row.categoryId] || "Sem categoria",
    value: row._count._all,
  }));

  const conditionChart = byCondition.map((row) => ({
    name: row.condition,
    value: row._count._all,
  }));

  const days = [];
  const cursor = new Date(range.start);
  while (cursor <= range.end) {
    const key = cursor.toISOString().slice(0, 10);
    days.push({ date: key, entradas: 0, saidas: 0 });
    cursor.setDate(cursor.getDate() + 1);
  }
  const dayMap = Object.fromEntries(days.map((day) => [day.date, day]));
  for (const movement of movements) {
    const key = movement.createdAt.toISOString().slice(0, 10);
    if (!dayMap[key]) continue;
    if (ENTRY_TYPES.includes(movement.type) && movement.newUnitId === unitId) dayMap[key].entradas += 1;
    if (EXIT_TYPES.includes(movement.type) && movement.previousUnitId === unitId) dayMap[key].saidas += 1;
  }

  const priceBands = PRICE_RANGES.map((band) => ({
    ...band,
    count: inStockProducts.filter((product) => {
      const price = product.cashPrice || 0;
      if (band.max == null) return price >= band.min;
      return price >= band.min && price < band.max;
    }).length,
  }));

  return {
    unit: serializeUnit(session.activeUnit),
    cards: {
      available,
      reserved,
      sold,
      inStock,
      inTransit,
      incoming: incomingCount,
      cash: totals.cash,
      installment: totals.installment,
      market: totals.market,
      margin: totals.market - totals.cash,
    },
    categoryChart,
    conditionChart,
    movementChart: days,
    priceBands,
    recentEntries,
    recentExits,
    range,
  };
}
