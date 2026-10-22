import { prisma } from "../db";
import { CONDITION_LABELS, CONDITIONS, SALE_ORDER_EVENT_TYPES, SALE_ORDER_ITEM_STATUSES, SALE_ORDER_ITEM_STATUS_LABELS, STATUSES } from "../constants";
import { calendarDayKey, formatCurrency, formatDate, formatProductId, periodRange } from "../format";
import { canViewAllSaleOrders } from "../permissions";
import { requireActiveUnit } from "../units";
import { saleOrderAccessWhere } from "./sale-orders";

const CONDITION_VALUES = new Set(Object.values(CONDITIONS));
const STOCK_STATUSES = [STATUSES.AVAILABLE, STATUSES.RESERVED];
const dayFormat = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });
const giroFormat = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });

function reportRange(filters) {
  if (filters.from || filters.to) {
    return periodRange(
      "custom",
      filters.from || "2000-01-01",
      filters.to || calendarDayKey(new Date()),
    );
  }
  return periodRange("30d");
}

function soldAmount(value) {
  if (value == null || value === "") return null;
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : null;
}

function quotedAmount(item) {
  return soldAmount(item.sale?.cashPrice) ?? soldAmount(item.cashPrice) ?? soldAmount(item.product?.cashPrice) ?? 0;
}

function productName(product) {
  return product?.catalogModel?.commercialName || product?.serialOnyx || "Produto";
}

function conditionOf(filters) {
  const value = String(filters.condition || "").trim();
  return CONDITION_VALUES.has(value) ? value : null;
}

function calendarDaysBetween(from, to) {
  if (!from || !to) return null;
  const start = calendarDayKey(from);
  const end = calendarDayKey(to);
  const startMs = new Date(`${start}T12:00:00.000-03:00`).getTime();
  const endMs = new Date(`${end}T12:00:00.000-03:00`).getTime();
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return null;
  return Math.max(0, Math.round((endMs - startMs) / 86400000));
}

function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2) return sorted[mid];
  return (sorted[mid - 1] + sorted[mid]) / 2;
}

function average(values) {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function formatDays(value) {
  if (value == null || !Number.isFinite(value)) return "—";
  return dayFormat.format(value);
}

function reservedByName(events, productId) {
  const token = `Produto ${formatProductId(productId)} reservado`;
  const match = [...(events || [])].reverse().find((event) => String(event.message || "").startsWith(token));
  return match?.user?.name || "—";
}

function modelIdentity(product) {
  if (product?.catalogModelId && product.catalogModel) {
    const code = product.catalogModel.supplierModelCode || "—";
    const name = product.catalogModel.commercialName || "Sem nome";
    return { key: `model-${product.catalogModelId}`, label: `${code} · ${name}` };
  }
  const code = String(product?.supplierModelCode || "").trim();
  if (code) return { key: `code-${code}`, label: `${code} · Sem modelo` };
  return { key: "none", label: "Sem modelo" };
}

const productSelect = {
  id: true,
  serialOnyx: true,
  cashPrice: true,
  entryDate: true,
  condition: true,
  catalogModelId: true,
  supplierModelCode: true,
  catalogModel: { select: { commercialName: true, supplierModelCode: true } },
};

export async function buildSalesDetailReport(session, filters = {}) {
  const unitId = requireActiveUnit(session);
  const range = reportRange(filters);
  const access = saleOrderAccessWhere(session);
  const orderWhere = { ...access, unitId };
  const inRange = { gte: range.start, lte: range.end };
  const condition = conditionOf(filters);

  const [items, standaloneSales] = await Promise.all([
    prisma.saleOrderItem.findMany({
      where: {
        status: SALE_ORDER_ITEM_STATUSES.SOLD,
        saleOrder: orderWhere,
        OR: [{ soldAt: inRange }, { sale: { soldAt: inRange } }],
        ...(condition ? { product: { condition } } : {}),
      },
      include: {
        sale: { select: { cashPrice: true, invoiceNumber: true } },
        soldBy: { select: { name: true } },
        product: { select: productSelect },
        saleOrder: {
          select: {
            ov: true,
            seller: { select: { name: true } },
            customer: { select: { name: true } },
            events: {
              where: { type: SALE_ORDER_EVENT_TYPES.RESERVE },
              orderBy: { createdAt: "asc" },
              select: { message: true, user: { select: { name: true } } },
            },
          },
        },
      },
    }),
    prisma.sale.findMany({
      where: {
        unitId,
        soldAt: inRange,
        saleOrderItems: { none: {} },
        ...(condition ? { product: { condition } } : {}),
        ...(canViewAllSaleOrders(session.role) ? {} : { createdById: Number(session.id) }),
      },
      include: {
        createdBy: { select: { name: true } },
        customer: { select: { name: true } },
        product: { select: productSelect },
      },
    }),
  ]);

  const lines = [
    ...items.map((item) => {
      const sold = item.status === SALE_ORDER_ITEM_STATUSES.SOLD;
      return {
        sortAt: item.soldAt || item.reservedAt,
        sold,
        amount: quotedAmount(item),
        cells: [
          formatDate(item.reservedAt),
          item.saleOrder?.customer?.name || "—",
          productName(item.product),
          item.product?.serialOnyx || "—",
          formatCurrency(quotedAmount(item)),
          formatDate(item.soldAt),
          item.invoiceNumber || item.sale?.invoiceNumber || "—",
          item.saleOrder?.ov || "—",
          SALE_ORDER_ITEM_STATUS_LABELS[item.status] || item.status,
          reservedByName(item.saleOrder?.events, item.productId),
          item.saleOrder?.seller?.name || "—",
          sold ? item.soldBy?.name || "—" : "—",
        ],
      };
    }),
    ...standaloneSales.map((sale) => ({
      sortAt: sale.soldAt,
      sold: true,
      amount: soldAmount(sale.cashPrice) ?? 0,
      cells: [
        "—",
        sale.customer?.name || "—",
        productName(sale.product),
        sale.product?.serialOnyx || "—",
        formatCurrency(soldAmount(sale.cashPrice) ?? 0),
        formatDate(sale.soldAt),
        sale.invoiceNumber || "—",
        "—",
        "Vendido",
        "—",
        sale.createdBy?.name || "—",
        sale.createdBy?.name || "—",
      ],
    })),
  ].sort((a, b) => new Date(b.sortAt || 0) - new Date(a.sortAt || 0));

  const soldLines = lines.filter((line) => line.sold);
  return {
    title: "Relatório de vendas",
    columns: [
      "Data da reserva",
      "Cliente",
      "Produto",
      "Serial Onyx",
      "Valor",
      "Data da venda",
      "NF",
      "OV",
      "Status",
      "Reservado por",
      "Vendedor",
      "Baixa por",
    ],
    rows: lines.map((line) => line.cells),
    summary: {
      count: lines.length,
      countLabel: "linhas",
      cash: soldLines.reduce((sum, line) => sum + line.amount, 0),
      installment: 0,
      market: 0,
      priceLabel: "valor vendido",
      note: `${soldLines.length} vendidos`,
    },
  };
}

export async function buildModelTurnoverReport(session, filters = {}) {
  const unitId = requireActiveUnit(session);
  const range = reportRange(filters);
  const access = saleOrderAccessWhere(session);
  const orderWhere = { ...access, unitId };
  const soldAt = { gte: range.start, lte: range.end };
  const condition = conditionOf(filters);
  const productWhere = condition ? { condition } : {};

  const [items, standaloneSales, stock] = await Promise.all([
    prisma.saleOrderItem.findMany({
      where: {
        status: SALE_ORDER_ITEM_STATUSES.SOLD,
        soldAt,
        saleOrder: orderWhere,
        ...(condition ? { product: productWhere } : {}),
      },
      include: {
        sale: { select: { cashPrice: true } },
        product: { select: productSelect },
      },
    }),
    prisma.sale.findMany({
      where: {
        unitId,
        soldAt,
        saleOrderItems: { none: {} },
        ...(condition ? { product: productWhere } : {}),
        ...(canViewAllSaleOrders(session.role) ? {} : { createdById: Number(session.id) }),
      },
      include: {
        product: { select: productSelect },
      },
    }),
    prisma.product.findMany({
      where: {
        unitId,
        deletedAt: null,
        status: { in: STOCK_STATUSES },
        ...productWhere,
      },
      select: productSelect,
    }),
  ]);

  const groups = new Map();
  function groupFor(product) {
    const identity = modelIdentity(product);
    const current = groups.get(identity.key) || {
      label: identity.label,
      days: [],
      amount: 0,
      stockAges: [],
    };
    groups.set(identity.key, current);
    return current;
  }

  function addSale(product, soldAtValue, amount) {
    const group = groupFor(product);
    const days = calendarDaysBetween(product?.entryDate, soldAtValue);
    if (days != null) group.days.push(days);
    group.amount += amount;
  }

  for (const item of items) addSale(item.product, item.soldAt, quotedAmount(item));
  for (const sale of standaloneSales) addSale(sale.product, sale.soldAt, soldAmount(sale.cashPrice) ?? 0);

  const now = new Date();
  for (const product of stock) {
    const identity = modelIdentity(product);
    if (!groups.has(identity.key)) continue;
    const age = calendarDaysBetween(product.entryDate, now);
    if (age != null) groups.get(identity.key).stockAges.push(age);
  }

  const ranked = [...groups.values()]
    .map((group) => {
      const count = group.days.length;
      const medianDays = median(group.days);
      const inRanking = count >= 2 && medianDays != null;
      const giro = inRanking ? count / Math.max(medianDays, 1) : null;
      return {
        label: group.label,
        count,
        medianDays,
        averageDays: average(group.days),
        fastest: group.days.length ? Math.min(...group.days) : null,
        slowest: group.days.length ? Math.max(...group.days) : null,
        amount: group.amount,
        giro,
        stock: group.stockAges.length,
        stockAge: average(group.stockAges),
      };
    })
    .sort((a, b) => {
      const aRanked = a.giro != null;
      const bRanked = b.giro != null;
      if (aRanked !== bRanked) return aRanked ? -1 : 1;
      if (aRanked && bRanked) return b.giro - a.giro || b.count - a.count;
      return b.count - a.count || (a.medianDays ?? 0) - (b.medianDays ?? 0);
    });

  const rankingCount = ranked.filter((row) => row.giro != null).length;
  const conditionNote = condition ? CONDITION_LABELS[condition] : null;

  return {
    title: "Giro dos modelos",
    columns: [
      "Modelo",
      "Qtd vendida",
      "Dias (mediana)",
      "Dias (média)",
      "Mais rápido",
      "Mais lento",
      "Valor vendido",
      "Giro",
      "Em estoque",
      "Idade média do estoque",
    ],
    rows: ranked.map((row) => [
      row.label,
      row.count,
      formatDays(row.medianDays),
      formatDays(row.averageDays),
      formatDays(row.fastest),
      formatDays(row.slowest),
      formatCurrency(row.amount),
      row.giro == null ? "—" : giroFormat.format(row.giro),
      row.stock,
      formatDays(row.stockAge),
    ]),
    summary: {
      count: ranked.length,
      countLabel: "modelos",
      cash: ranked.reduce((sum, row) => sum + row.amount, 0),
      installment: 0,
      market: 0,
      priceLabel: "valor vendido",
      note: [`${rankingCount} no ranking (2 ou mais vendas)`, conditionNote].filter(Boolean).join(" · "),
    },
  };
}
