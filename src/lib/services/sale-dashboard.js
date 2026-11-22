import { prisma } from "../db";
import {
  SALE_ORDER_CLOSED_STATUSES,
  SALE_ORDER_EVENT_TYPES,
  SALE_ORDER_ITEM_STATUSES,
  SALE_ORDER_STATUS_LABELS,
} from "../constants";
import { calendarDayKey, eachSaoPauloDay, formatCurrency, formatDateTime, formatProductId, periodRange } from "../format";
import { canViewAllSaleOrders } from "../permissions";
import { requireActiveUnit, serializeUnit } from "../units";
import { saleOrderAccessWhere } from "./sale-orders";

function dayKey(value) {
  return calendarDayKey(value);
}

function soldAmount(value) {
  if (value == null || value === "") return null;
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : null;
}

function money(value) {
  const amount = soldAmount(value);
  return amount == null ? 0 : Math.round(amount * 100) / 100;
}

function amountOf(item) {
  const fromSale = soldAmount(item.sale?.cashPrice);
  if (fromSale != null) return fromSale;
  const fromItem = soldAmount(item.cashPrice);
  return fromItem != null ? fromItem : 0;
}

function paymentMethodName(method) {
  const name = String(method || "").trim();
  return name || "Não informado";
}

function reservedByFromEvents(events, productId) {
  const token = `Produto ${formatProductId(productId)} reservado`;
  const match = [...(events || [])].reverse().find((event) => String(event.message || "").startsWith(token));
  if (!match?.user) return { id: 0, name: "Sem reserva" };
  return { id: match.user.id || 0, name: match.user.name || "Sem reserva" };
}

function paymentLabel(method, count) {
  const name = String(method || "").trim();
  const parcels = Number(count);
  const hasParcels = Number.isInteger(parcels) && parcels > 0;
  if (name && hasParcels) return `${name} · ${parcels}x`;
  if (name) return name;
  if (hasParcels) return `${parcels}x`;
  return "Não informado";
}

/** @returns {"cash"|"installment"|null} */
export function paymentKind(paymentMethod, installmentCount) {
  const parcels = Number(installmentCount);
  if (Number.isInteger(parcels) && parcels > 1) return "installment";
  if (Number.isInteger(parcels) && parcels === 1) return "cash";
  const method = String(paymentMethod || "").toLocaleLowerCase("pt-BR");
  if (!method) return null;
  if (/pix|dinheiro|d[eé]bito|transfer/.test(method)) return "cash";
  if (/cr[eé]dito|boleto|parcel/.test(method)) return "installment";
  return null;
}

function referenceOf(product, kind) {
  if (kind === "cash") return soldAmount(product?.cashPrice);
  if (kind === "installment") return soldAmount(product?.installmentPrice);
  return null;
}

function discountOf(sold, reference) {
  if (reference == null) return null;
  return Math.round((reference - sold) * 100) / 100;
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
  return eachSaoPauloDay(start, end).map((day) => ({ ...day, amount: 0, count: 0 }));
}

const productCommercialSelect = {
  id: true,
  serialOnyx: true,
  cashPrice: true,
  installmentPrice: true,
  catalogModel: { select: { commercialName: true } },
  category: { select: { id: true, name: true } },
  images: { where: { isPrimary: true }, take: 1, select: { fileUrl: true } },
};

function enrichRow({
  id,
  soldAt,
  amount,
  paymentMethod,
  installmentCount,
  product,
  ...rest
}) {
  const kind = paymentKind(paymentMethod, installmentCount);
  const listPrice = referenceOf(product, kind);
  const discount = discountOf(amount, listPrice);
  return {
    id,
    soldAt,
    amount,
    paymentMethod,
    installmentCount,
    paymentKind: kind,
    listPrice,
    discount,
    discountGranted: discount != null && discount > 0 ? discount : 0,
    categoryId: product?.category?.id || 0,
    categoryName: product?.category?.name || "Sem categoria",
    productId: product?.id,
    serialOnyx: product?.serialOnyx || "—",
    commercialName: product?.catalogModel?.commercialName || product?.serialOnyx || "Produto",
    imageUrl: product?.images?.[0]?.fileUrl || null,
    ...rest,
  };
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
        sale: { select: { cashPrice: true, invoiceNumber: true, paymentMethod: true, installmentCount: true } },
        saleOrder: {
          select: {
            id: true,
            number: true,
            paymentMethod: true,
            installmentCount: true,
            sellerId: true,
            seller: { select: { id: true, name: true } },
            customer: { select: { id: true, name: true } },
            events: {
              where: { type: SALE_ORDER_EVENT_TYPES.RESERVE },
              orderBy: { createdAt: "asc" },
              select: { message: true, user: { select: { id: true, name: true } } },
            },
          },
        },
        soldBy: { select: { id: true, name: true } },
        product: { select: productCommercialSelect },
      },
      orderBy: { soldAt: "desc" },
    }),
    prisma.sale.findMany({
      where: {
        unitId,
        soldAt,
        saleOrderItems: { none: {} },
        ...(canViewAllSaleOrders(session) ? {} : { createdById: Number(session.id) }),
      },
      include: {
        createdBy: { select: { id: true, name: true } },
        customer: { select: { id: true, name: true } },
        product: { select: productCommercialSelect },
      },
      orderBy: { soldAt: "desc" },
    }),
  ]);

  return [
    ...items.map((item) => {
      const paymentMethod = item.sale?.paymentMethod || item.saleOrder?.paymentMethod || null;
      const installmentCount = item.sale?.installmentCount ?? item.saleOrder?.installmentCount ?? null;
      const reservedBy = reservedByFromEvents(item.saleOrder?.events, item.productId);
      return enrichRow({
        id: `item-${item.id}`,
        soldAt: item.soldAt,
        amount: amountOf(item),
        paymentMethod,
        installmentCount,
        paymentLabel: paymentLabel(paymentMethod, installmentCount),
        sellerId: item.saleOrder?.sellerId || 0,
        sellerName: item.saleOrder?.seller?.name || "Sem vendedor",
        attendantId: item.soldBy?.id || 0,
        attendantName: item.soldBy?.name || "Sem atendente",
        reserverId: reservedBy.id,
        reserverName: reservedBy.name,
        saleNumber: item.saleOrder?.number || null,
        invoiceNumber: item.invoiceNumber || item.sale?.invoiceNumber || null,
        customerId: item.saleOrder?.customer?.id || 0,
        customerName: item.saleOrder?.customer?.name || "Sem cliente",
        origin: "Comercial",
        product: item.product,
      });
    }),
    ...standaloneSales.map((sale) => enrichRow({
      id: `sale-${sale.id}`,
      soldAt: sale.soldAt,
      amount: soldAmount(sale.cashPrice) ?? 0,
      paymentMethod: sale.paymentMethod || null,
      installmentCount: sale.installmentCount ?? null,
      paymentLabel: paymentLabel(sale.paymentMethod, sale.installmentCount),
      sellerId: sale.createdBy?.id || 0,
      sellerName: sale.createdBy?.name || "Sem vendedor",
      attendantId: sale.createdBy?.id || 0,
      attendantName: sale.createdBy?.name || "Sem atendente",
      reserverId: sale.createdBy?.id || 0,
      reserverName: sale.createdBy?.name || "Sem reserva",
      saleNumber: null,
      invoiceNumber: sale.invoiceNumber || null,
      customerId: sale.customer?.id || 0,
      customerName: sale.customer?.name || "Sem cliente",
      origin: "Baixa avulsa",
      product: sale.product,
    })),
  ].sort((a, b) => new Date(b.soldAt) - new Date(a.soldAt));
}

async function priorCustomerIdSet(unitId, customerIds, before) {
  const ids = [...new Set(customerIds.filter(Boolean))];
  if (!ids.length) return new Set();

  const [fromOrders, fromStandalone] = await Promise.all([
    prisma.saleOrder.findMany({
      where: {
        unitId,
        customerId: { in: ids },
        items: {
          some: {
            status: SALE_ORDER_ITEM_STATUSES.SOLD,
            soldAt: { lt: before },
          },
        },
      },
      select: { customerId: true },
      distinct: ["customerId"],
    }),
    prisma.sale.findMany({
      where: {
        unitId,
        customerId: { in: ids },
        soldAt: { lt: before },
        saleOrderItems: { none: {} },
      },
      select: { customerId: true },
      distinct: ["customerId"],
    }),
  ]);

  return new Set(
    [...fromOrders, ...fromStandalone]
      .map((row) => row.customerId)
      .filter(Boolean),
  );
}

function buildCustomerInsights(rows, priorIds, totalAmount) {
  const map = new Map();

  for (const row of rows) {
    const id = row.customerId || 0;
    const key = id || `name:${row.customerName || "Sem cliente"}`;
    const current = map.get(key) || {
      id,
      name: row.customerName || "Sem cliente",
      amount: 0,
      itemCount: 0,
      orders: new Set(),
    };
    current.amount += row.amount;
    current.itemCount += 1;
    current.orders.add(row.saleNumber || row.id);
    if (row.customerName && current.name === "Sem cliente") current.name = row.customerName;
    map.set(key, current);
  }

  const customers = [...map.values()].map((row) => {
    const orderCount = row.orders.size;
    const ticket = orderCount ? row.amount / orderCount : 0;
    const returning = Boolean(row.id && priorIds.has(row.id));
    return {
      id: row.id,
      name: row.name,
      amount: row.amount,
      itemCount: row.itemCount,
      orderCount,
      ticket,
      recurring: orderCount >= 2,
      returning,
      segment: returning ? "recorrente" : "novo",
      share: totalAmount ? row.amount / totalAmount : 0,
    };
  });

  customers.sort((a, b) => b.amount - a.amount || b.orderCount - a.orderCount || a.name.localeCompare(b.name, "pt-BR"));

  const activeCount = customers.length;
  const recurringCount = customers.filter((row) => row.recurring).length;
  const returningCount = customers.filter((row) => row.returning).length;
  const newCount = customers.filter((row) => !row.returning).length;
  const returningAmount = customers.filter((row) => row.returning).reduce((sum, row) => sum + row.amount, 0);
  const newAmount = totalAmount - returningAmount;
  const topSlice = Math.max(1, Math.ceil(customers.length * 0.2));
  const topAmount = customers.slice(0, topSlice).reduce((sum, row) => sum + row.amount, 0);

  return {
    cards: {
      activeCustomers: activeCount,
      recurringCustomers: recurringCount,
      recurringShare: activeCount ? recurringCount / activeCount : 0,
      returningCustomers: returningCount,
      newCustomers: newCount,
      ticketPerCustomer: activeCount ? totalAmount / activeCount : 0,
      top20Share: totalAmount ? topAmount / totalAmount : 0,
      returningAmount,
      newAmount,
      returningShare: totalAmount ? returningAmount / totalAmount : 0,
      newShare: totalAmount ? newAmount / totalAmount : 0,
    },
    byRevenue: customers.slice(0, 15),
    byFrequency: [...customers]
      .filter((row) => row.orderCount >= 2)
      .sort((a, b) => b.orderCount - a.orderCount || b.amount - a.amount)
      .slice(0, 15),
    byTicket: [...customers]
      .filter((row) => row.orderCount >= 1)
      .sort((a, b) => b.ticket - a.ticket || b.amount - a.amount)
      .slice(0, 15),
    segments: [
      {
        id: "returning",
        name: "Recorrentes (já compraram antes)",
        count: returningCount,
        amount: returningAmount,
        share: totalAmount ? returningAmount / totalAmount : 0,
      },
      {
        id: "new",
        name: "Novos no período",
        count: newCount,
        amount: newAmount,
        share: totalAmount ? newAmount / totalAmount : 0,
      },
    ],
  };
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

  const priorIds = await priorCustomerIdSet(
    unitId,
    rows.map((row) => row.customerId),
    range.start,
  );

  const totalAmount = rows.reduce((sum, row) => sum + row.amount, 0);
  const totalCount = rows.length;
  const orderIds = new Set(rows.map((row) => row.saleNumber).filter(Boolean));
  const standaloneCount = rows.filter((row) => !row.saleNumber).length;
  const pricedRows = rows.filter((row) => row.listPrice != null);
  const totalListPrice = pricedRows.reduce((sum, row) => sum + money(row.listPrice), 0);
  const totalDiscount = pricedRows.reduce((sum, row) => sum + (row.discountGranted || 0), 0);

  const byType = new Map();
  const bySeller = new Map();
  const byAttendant = new Map();
  const byReserver = new Map();
  const byPayment = new Map();
  const days = emptyDays(range.start, range.end);
  const dayMap = Object.fromEntries(days.map((day) => [day.date, day]));

  for (const row of rows) {
    bump(byType, row.categoryId, row.categoryName, row.amount);
    bump(bySeller, row.sellerId, row.sellerName, row.amount);
    bump(byAttendant, row.attendantId, row.attendantName, row.amount);
    bump(byReserver, row.reserverId || 0, row.reserverName || "Sem reserva", row.amount);
    const methodName = paymentMethodName(row.paymentMethod);
    bump(byPayment, methodName.toLocaleLowerCase("pt-BR"), methodName, row.amount);
    const key = row.soldAt ? dayKey(row.soldAt) : null;
    if (key && dayMap[key]) {
      dayMap[key].amount += row.amount;
      dayMap[key].count += 1;
    }
  }

  return {
    unit: serializeUnit(session.activeUnit),
    range,
    canViewAll: canViewAllSaleOrders(session),
    cards: {
      amount: totalAmount,
      count: totalCount,
      ticket: totalCount ? totalAmount / totalCount : 0,
      orders: orderIds.size + standaloneCount,
      listPrice: totalListPrice,
      discount: totalDiscount,
      pricedCount: pricedRows.length,
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
    byReserver: ranked(byReserver, totalAmount),
    byPayment: ranked(byPayment, totalAmount),
    customers: buildCustomerInsights(rows, priorIds, totalAmount),
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
      "Forma de pagamento",
      "Parcelas",
      "Tipo preço",
      "Valor vendido",
      "Preço referência",
      "Desconto",
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
      row.paymentMethod || "—",
      row.installmentCount || "—",
      row.paymentKind === "cash" ? "À vista" : row.paymentKind === "installment" ? "A prazo" : "—",
      formatCurrency(row.amount),
      row.listPrice == null ? "—" : formatCurrency(row.listPrice),
      row.discount == null ? "—" : formatCurrency(row.discount),
    ]),
    summary: (() => {
      const priced = rows.filter((row) => row.listPrice != null);
      const listTotal = priced.reduce((sum, row) => sum + money(row.listPrice), 0);
      const discountTotal = priced.reduce((sum, row) => sum + (row.discountGranted || 0), 0);
      return {
        count: rows.length,
        cash: rows.reduce((sum, row) => sum + row.amount, 0),
        installment: 0,
        market: 0,
        priceLabel: "valor vendido",
        note: `Referência ${formatCurrency(listTotal)} · desconto ${formatCurrency(discountTotal)} (${priced.length} classificados). Compara à vista (1x) ou parcelado (2x+).`,
      };
    })(),
  };
}
