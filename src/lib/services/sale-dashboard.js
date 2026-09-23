import { prisma } from "../db";
import { SALE_ORDER_CLOSED_STATUSES, SALE_ORDER_ITEM_STATUSES, SALE_ORDER_STATUS_LABELS } from "../constants";
import { formatCurrency, formatDate, formatDateTime, periodRange } from "../format";
import { canViewAllSaleOrders } from "../permissions";
import { requireActiveUnit, serializeUnit } from "../units";
import { saleOrderAccessWhere } from "./sale-orders";

function dayKey(value) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date(value));
}

function amountOf(item) {
  return Number(item.cashPrice ?? item.sale?.cashPrice ?? item.product?.cashPrice ?? 0);
}

function bump(map, key, name, amount) {
  const current = map.get(key) || { id: key, name, amount: 0, count: 0 };
  current.amount += amount;
  current.count += 1;
  map.set(key, current);
}

function ranked(map, total) {
  return [...map.values()]
    .sort((a, b) => b.amount - a.amount || b.count - a.count)
    .map((row) => ({
      ...row,
      share: total ? row.amount / total : 0,
    }));
}

function emptyDays(start, end) {
  const days = [];
  const cursor = new Date(start);
  cursor.setHours(0, 0, 0, 0);
  const last = new Date(end);
  last.setHours(0, 0, 0, 0);
  while (cursor <= last) {
    const key = dayKey(cursor);
    days.push({ date: key, label: formatDate(cursor), amount: 0, count: 0 });
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

export async function listSoldCommercialRows(session, range) {
  const unitId = requireActiveUnit(session);
  const access = saleOrderAccessWhere(session);
  const orderWhere = { ...access, unitId };
  const soldAt = { gte: range.start, lte: range.end };

  const [items, standaloneSales] = await Promise.all([
    prisma.saleOrderItem.findMany({
      where: {
        status: SALE_ORDER_ITEM_STATUSES.SOLD,
        soldAt,
        saleOrder: orderWhere,
      },
      include: {
        sale: { select: { cashPrice: true, invoiceNumber: true } },
        saleOrder: {
          select: {
            id: true,
            number: true,
            sellerId: true,
            seller: { select: { id: true, name: true } },
            customer: { select: { id: true, name: true } },
          },
        },
        soldBy: { select: { id: true, name: true } },
        product: {
          select: {
            id: true,
            serialOnyx: true,
            cashPrice: true,
            catalogModel: { select: { commercialName: true } },
            category: { select: { id: true, name: true } },
            images: { where: { isPrimary: true }, take: 1, select: { fileUrl: true } },
          },
        },
      },
      orderBy: { soldAt: "desc" },
    }),
    prisma.sale.findMany({
      where: {
        unitId,
        soldAt,
        saleOrderItems: { none: {} },
        ...(canViewAllSaleOrders(session.role) ? {} : { createdById: Number(session.id) }),
      },
      include: {
        createdBy: { select: { id: true, name: true } },
        customer: { select: { id: true, name: true } },
        product: {
          select: {
            id: true,
            serialOnyx: true,
            cashPrice: true,
            catalogModel: { select: { commercialName: true } },
            category: { select: { id: true, name: true } },
            images: { where: { isPrimary: true }, take: 1, select: { fileUrl: true } },
          },
        },
      },
      orderBy: { soldAt: "desc" },
    }),
  ]);

  return [
    ...items.map((item) => ({
      id: `item-${item.id}`,
      soldAt: item.soldAt,
      amount: amountOf(item),
      categoryId: item.product?.category?.id || 0,
      categoryName: item.product?.category?.name || "Sem categoria",
      sellerId: item.saleOrder?.sellerId || 0,
      sellerName: item.saleOrder?.seller?.name || "Sem vendedor",
      attendantId: item.soldBy?.id || 0,
      attendantName: item.soldBy?.name || "Sem atendente",
      saleNumber: item.saleOrder?.number || null,
      invoiceNumber: item.invoiceNumber || item.sale?.invoiceNumber || null,
      customerName: item.saleOrder?.customer?.name || "—",
      origin: "Comercial",
      productId: item.product?.id,
      serialOnyx: item.product?.serialOnyx || "—",
      commercialName: item.product?.catalogModel?.commercialName || item.product?.serialOnyx || "Produto",
      imageUrl: item.product?.images?.[0]?.fileUrl || null,
    })),
    ...standaloneSales.map((sale) => ({
      id: `sale-${sale.id}`,
      soldAt: sale.soldAt,
      amount: Number(sale.cashPrice ?? sale.product?.cashPrice ?? 0),
      categoryId: sale.product?.category?.id || 0,
      categoryName: sale.product?.category?.name || "Sem categoria",
      sellerId: sale.createdBy?.id || 0,
      sellerName: sale.createdBy?.name || "Sem vendedor",
      attendantId: sale.createdBy?.id || 0,
      attendantName: sale.createdBy?.name || "Sem atendente",
      saleNumber: null,
      invoiceNumber: sale.invoiceNumber || null,
      customerName: sale.customer?.name || "—",
      origin: "Baixa avulsa",
      productId: sale.product?.id,
      serialOnyx: sale.product?.serialOnyx || "—",
      commercialName: sale.product?.catalogModel?.commercialName || sale.product?.serialOnyx || "Produto",
      imageUrl: sale.product?.images?.[0]?.fileUrl || null,
    })),
  ].sort((a, b) => new Date(b.soldAt) - new Date(a.soldAt));
}

export async function getSaleDashboard(session, { period = "30d", from, to } = {}) {
  const { expireExpiredReservations } = await import("./sale-orders");
  await expireExpiredReservations();
  const unitId = requireActiveUnit(session);
  const range = periodRange(period, from, to);
  const access = saleOrderAccessWhere(session);
  const orderWhere = { ...access, unitId };
  const createdAt = { gte: range.start, lte: range.end };

  const [rows, pipeline, periodPipeline] = await Promise.all([
    listSoldCommercialRows(session, range),
    prisma.saleOrder.groupBy({
      by: ["status"],
      where: {
        ...orderWhere,
        closedAt: null,
        status: { notIn: SALE_ORDER_CLOSED_STATUSES },
      },
      _count: { _all: true },
    }),
    prisma.saleOrder.groupBy({
      by: ["status"],
      where: { ...orderWhere, createdAt },
      _count: { _all: true },
    }),
  ]);

  const totalAmount = rows.reduce((sum, row) => sum + row.amount, 0);
  const totalCount = rows.length;
  const orderIds = new Set(rows.map((row) => row.saleNumber).filter(Boolean));
  const standaloneCount = rows.filter((row) => !row.saleNumber).length;

  const byType = new Map();
  const bySeller = new Map();
  const byAttendant = new Map();
  const days = emptyDays(range.start, range.end);
  const dayMap = Object.fromEntries(days.map((day) => [day.date, day]));

  for (const row of rows) {
    bump(byType, row.categoryId, row.categoryName, row.amount);
    bump(bySeller, row.sellerId, row.sellerName, row.amount);
    bump(byAttendant, row.attendantId, row.attendantName, row.amount);
    const key = row.soldAt ? dayKey(row.soldAt) : null;
    if (key && dayMap[key]) {
      dayMap[key].amount += row.amount;
      dayMap[key].count += 1;
    }
  }

  return {
    unit: serializeUnit(session.activeUnit),
    range,
    canViewAll: canViewAllSaleOrders(session.role),
    cards: {
      amount: totalAmount,
      count: totalCount,
      ticket: totalCount ? totalAmount / totalCount : 0,
      orders: orderIds.size + standaloneCount,
    },
    pipeline: pipeline
      .map((row) => ({
        status: row.status,
        label: SALE_ORDER_STATUS_LABELS[row.status] || row.status,
        count: row._count._all,
      }))
      .sort((a, b) => b.count - a.count),
    periodPipeline: periodPipeline
      .map((row) => ({
        status: row.status,
        label: SALE_ORDER_STATUS_LABELS[row.status] || row.status,
        count: row._count._all,
      }))
      .sort((a, b) => b.count - a.count),
    byType: ranked(byType, totalAmount),
    bySeller: ranked(bySeller, totalAmount),
    byAttendant: ranked(byAttendant, totalAmount),
    daily: days,
    recent: rows.slice(0, 8),
  };
}

export function commercialReportRows(rows) {
  return {
    title: "Faturamento comercial",
    columns: [
      "Data",
      "Pedido",
      "Origem",
      "ID",
      "Serial",
      "Produto",
      "Categoria",
      "Cliente",
      "Vendedor",
      "Atendente",
      "NF",
      "Valor à vista",
    ],
    rows: rows.map((row) => [
      formatDateTime(row.soldAt),
      row.saleNumber || "—",
      row.origin,
      row.productId,
      row.serialOnyx,
      row.commercialName,
      row.categoryName,
      row.customerName,
      row.sellerName,
      row.attendantName,
      row.invoiceNumber || "—",
      formatCurrency(row.amount),
    ]),
    summary: {
      count: rows.length,
      cash: rows.reduce((sum, row) => sum + row.amount, 0),
      installment: 0,
      market: 0,
    },
  };
}
