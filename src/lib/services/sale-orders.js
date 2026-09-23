import { prisma } from "../db";
import { conflict, forbidden, notFound, validationError } from "../errors";
import { writeAudit, writeMovement } from "../audit";
import {
  EXIT_REASONS,
  MOVEMENT_TYPES,
  SALE_ORDER_CLOSED_STATUSES,
  SALE_ORDER_EVENT_TYPES,
  SALE_ORDER_ITEM_STATUSES,
  SALE_ORDER_STATUSES,
  STATUSES,
  isSaleOrderClosed,
  ROLES,
} from "../constants";
import { emptyToNull, parseId } from "../validations";
import { paginationResult, parsePagination } from "../pagination";
import { formatDate, formatProductId } from "../format";
import { can, canManageAllSaleOrders, canViewAllSaleOrders, PERMISSIONS } from "../permissions";
import { isAdminRole, requireActiveUnit, unitSelect } from "../units";
import { getProduct, movementUnitFields } from "./products";
import { getLatestSale } from "./sales";

const productSelect = {
  id: true,
  serialOnyx: true,
  status: true,
  cashPrice: true,
  condition: true,
  catalogModel: { select: { commercialName: true } },
  category: { select: { id: true, name: true } },
  images: { where: { isPrimary: true }, take: 1, select: { fileUrl: true } },
  unit: { select: unitSelect },
};

const itemInclude = {
  product: { select: productSelect },
  sale: { select: { id: true, invoiceNumber: true, warrantyMonths: true, soldAt: true } },
  soldBy: { select: { id: true, name: true } },
};

const userNameSelect = { id: true, name: true };

const orderInclude = {
  customer: true,
  unit: { select: unitSelect },
  seller: { select: userNameSelect },
  createdBy: { select: userNameSelect },
  conversation: { select: { id: true, phone: true, contactName: true, status: true } },
  items: {
    include: itemInclude,
    orderBy: { createdAt: "asc" },
  },
  events: {
    include: { user: { select: userNameSelect } },
    orderBy: { createdAt: "desc" },
  },
};

const ACTIVE_ITEM_STATUSES = [
  SALE_ORDER_ITEM_STATUSES.INTEREST,
  SALE_ORDER_ITEM_STATUSES.RESERVED,
  SALE_ORDER_ITEM_STATUSES.ORDERED,
];

const LOCKING_ITEM_STATUSES = [
  SALE_ORDER_ITEM_STATUSES.RESERVED,
  SALE_ORDER_ITEM_STATUSES.ORDERED,
];

function formatSaleOrderNumber(id) {
  return `VD-${String(id).padStart(6, "0")}`;
}

export function saleOrderAccessWhere(session) {
  const where = {};
  if (!isAdminRole(session.role)) {
    where.unitId = { in: (session.units || []).map((unit) => unit.id) };
  }
  if (!canViewAllSaleOrders(session.role)) {
    where.sellerId = Number(session.id);
  }
  return where;
}

function canOperateSaleOrder(session, order) {
  if (!session || !order) return false;
  if (canManageAllSaleOrders(session.role)) return true;
  return Number(order.sellerId) === Number(session.id);
}

function canViewSaleOrder(session, order) {
  if (!session || !order) return false;
  if (!isAdminRole(session.role)) {
    const ids = (session.units || []).map((unit) => unit.id);
    if (!ids.includes(order.unitId)) return false;
  }
  if (canViewAllSaleOrders(session.role)) return true;
  return Number(order.sellerId) === Number(session.id);
}

function assertCanView(session, order) {
  if (!canViewSaleOrder(session, order)) throw notFound("Venda não encontrada.");
}

function assertCanOperate(session, order) {
  assertCanView(session, order);
  if (!canOperateSaleOrder(session, order)) {
    throw forbidden("Esta venda pertence a outro vendedor.");
  }
}

async function resolveSeller(payload, user) {
  const requested = payload.sellerId != null && String(payload.sellerId).trim() !== ""
    ? parseId(payload.sellerId)
    : Number(user.id);
  if (requested !== Number(user.id) && !canManageAllSaleOrders(user.role)) {
    throw forbidden("Você só pode abrir vendas no seu nome.");
  }
  const seller = await prisma.user.findUnique({
    where: { id: requested },
    select: { id: true, name: true, active: true, role: true },
  });
  if (!seller?.active) throw validationError("Vendedor inválido ou inativo.");
  if (!can(seller.role, PERMISSIONS.SALE_CREATE)) {
    throw validationError("Este usuário não pode ser vinculado como vendedor.");
  }
  return seller;
}

async function resolveConversation(payload, customerId, user) {
  if (payload.conversationId == null || String(payload.conversationId).trim() === "") return null;
  const conversationId = parseId(payload.conversationId);
  const conversation = await prisma.inboxConversation.findUnique({
    where: { id: conversationId },
    select: { id: true, customerId: true, teamId: true, phone: true, contactName: true },
  });
  if (!conversation) throw validationError("Conversa não encontrada.");
  if (conversation.customerId && Number(conversation.customerId) !== Number(customerId)) {
    throw validationError("Esta conversa está vinculada a outro cliente.");
  }
  if (!conversation.customerId) {
    await prisma.inboxConversation.update({
      where: { id: conversation.id },
      data: { customerId },
    });
    await prisma.inboxConversationEvent.create({
      data: {
        conversationId: conversation.id,
        type: "CLIENTE",
        message: "Cliente vinculado ao abrir a venda comercial.",
        userId: user.id,
      },
    });
  }
  const { addCustomerPhone } = await import("./customers");
  await addCustomerPhone(customerId, conversation.phone, { label: "WhatsApp" });
  return conversation;
}

function lockingConflictMessage(session, locked, reserved = false) {
  if (canViewAllSaleOrders(session.role) && locked?.saleOrder?.number) {
    return reserved
      ? `Este produto já está reservado na venda ${locked.saleOrder.number}.`
      : `Este produto já está na venda ${locked.saleOrder.number}.`;
  }
  return reserved
    ? "Este produto já está reservado em outra venda."
    : "Este produto já está em outra venda.";
}

function assertOpen(order) {
  if (isSaleOrderClosed(order)) {
    throw conflict("Esta venda já foi encerrada.");
  }
}

function serializeItem(item) {
  if (!item) return null;
  return {
    ...item,
    commercialName: item.product?.catalogModel?.commercialName || null,
    primaryImage: item.product?.images?.[0] || null,
  };
}

function parseReservedUntil(value) {
  const text = String(value || "").trim();
  if (!text) throw validationError("Informe até quando o produto ficará reservado.");
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!match) throw validationError("Data da reserva inválida.");
  const end = new Date(`${match[1]}-${match[2]}-${match[3]}T23:59:59.999-03:00`);
  if (Number.isNaN(end.getTime())) throw validationError("Data da reserva inválida.");
  if (end < new Date()) {
    throw validationError("A reserva não pode terminar em uma data passada.");
  }
  return end;
}

function clearReservationData() {
  return {
    status: SALE_ORDER_ITEM_STATUSES.INTEREST,
    reservedAt: null,
    reservedUntil: null,
  };
}

let expiringReservations = null;

export async function expireExpiredReservations() {
  if (expiringReservations) return expiringReservations;
  expiringReservations = (async () => {
    const expired = await prisma.saleOrderItem.findMany({
      where: {
        status: { in: LOCKING_ITEM_STATUSES },
        reservedUntil: { lt: new Date() },
        saleOrder: { closedAt: null, status: { notIn: SALE_ORDER_CLOSED_STATUSES } },
      },
      include: {
        saleOrder: { select: { id: true, number: true, createdById: true, sellerId: true } },
        product: { select: { id: true, status: true, unitId: true, locationId: true } },
      },
    });
    if (!expired.length) return 0;

    const orderIds = new Set();
    for (const item of expired) {
      await prisma.saleOrderItem.update({
        where: { id: item.id },
        data: clearReservationData(),
      });
      if (item.product?.status === STATUSES.RESERVED) {
        await prisma.product.update({
          where: { id: item.productId },
          data: { status: STATUSES.AVAILABLE },
        });
        await writeMovement({
          productId: item.productId,
          type: MOVEMENT_TYPES.UNRESERVE,
          previousStatus: STATUSES.RESERVED,
          newStatus: STATUSES.AVAILABLE,
          observation: `Prazo da reserva da venda ${item.saleOrder.number} encerrado.`,
          ...movementUnitFields(item.product),
          userId: item.saleOrder.createdById,
        });
        await writeAudit({
          userId: item.saleOrder.createdById,
          action: "STOCK_UNRESERVE",
          entity: "product",
          entityId: item.productId,
          oldData: { status: STATUSES.RESERVED },
          newData: { status: STATUSES.AVAILABLE, reason: "RESERVE_EXPIRED" },
        });
      }
      await addEvent(prisma, {
        saleOrderId: item.saleOrderId,
        type: SALE_ORDER_EVENT_TYPES.RESERVE,
        message: `Reserva do produto ${formatProductId(item.productId)} liberada automaticamente: prazo encerrado em ${formatDate(item.reservedUntil)}.`,
        userId: item.saleOrder.createdById,
      });
      orderIds.add(item.saleOrderId);
    }
    for (const orderId of orderIds) {
      await persistDerivedStatus(prisma, orderId);
    }
    return expired.length;
  })().finally(() => {
    expiringReservations = null;
  });
  return expiringReservations;
}

function deriveStatus(order, items = order.items || []) {
  if (order.status === SALE_ORDER_STATUSES.CANCELLED || order.status === SALE_ORDER_STATUSES.LOST) {
    return order.status;
  }
  const active = items.filter((item) => item.status !== SALE_ORDER_ITEM_STATUSES.REMOVED);
  const sold = active.filter((item) => item.status === SALE_ORDER_ITEM_STATUSES.SOLD);
  const ordered = active.filter((item) => item.status === SALE_ORDER_ITEM_STATUSES.ORDERED);
  const reserved = active.filter((item) => item.status === SALE_ORDER_ITEM_STATUSES.RESERVED);
  if (active.length && sold.length === active.length) return SALE_ORDER_STATUSES.COMPLETED;
  if (sold.length && (ordered.length || reserved.length || active.length > sold.length)) {
    return SALE_ORDER_STATUSES.PARTIAL;
  }
  if (order.orderedAt || ordered.length) return SALE_ORDER_STATUSES.ORDER;
  if (reserved.length) return SALE_ORDER_STATUSES.RESERVED;
  return SALE_ORDER_STATUSES.INTEREST;
}

export function serializeSaleOrder(order, session) {
  if (!order) return null;
  const items = (order.items || []).map(serializeItem);
  const active = items.filter((item) => item.status !== SALE_ORDER_ITEM_STATUSES.REMOVED);
  return {
    ...order,
    items,
    closed: isSaleOrderClosed(order),
    canOperate: canOperateSaleOrder(session, order),
    itemCounts: {
      total: active.length,
      interest: active.filter((item) => item.status === SALE_ORDER_ITEM_STATUSES.INTEREST).length,
      reserved: active.filter((item) => item.status === SALE_ORDER_ITEM_STATUSES.RESERVED).length,
      ordered: active.filter((item) => item.status === SALE_ORDER_ITEM_STATUSES.ORDERED).length,
      sold: active.filter((item) => item.status === SALE_ORDER_ITEM_STATUSES.SOLD).length,
    },
  };
}

async function addEvent(db, { saleOrderId, type, message, userId }) {
  return db.saleOrderEvent.create({
    data: { saleOrderId, type, message, userId },
  });
}

async function persistDerivedStatus(db, orderId) {
  const order = await db.saleOrder.findUnique({
    where: { id: orderId },
    include: { items: true },
  });
  const status = deriveStatus(order);
  const closed =
    SALE_ORDER_CLOSED_STATUSES.includes(status) ||
    (status === SALE_ORDER_STATUSES.PARTIAL && order.closedAt);
  const data = { status };
  if (status === SALE_ORDER_STATUSES.COMPLETED && !order.closedAt) {
    data.closedAt = new Date();
  }
  if (!closed && order.closedAt && status !== SALE_ORDER_STATUSES.PARTIAL) {
    data.closedAt = null;
  }
  if (status !== order.status || data.closedAt !== undefined) {
    await db.saleOrder.update({ where: { id: orderId }, data });
  }
  return status;
}

async function getRawOrder(id, session) {
  await expireExpiredReservations();
  const order = await prisma.saleOrder.findUnique({
    where: { id: Number(id) },
    include: orderInclude,
  });
  if (!order) throw notFound("Venda não encontrada.");
  assertCanView(session, order);
  return order;
}

export async function getSaleOrder(id, session) {
  return serializeSaleOrder(await getRawOrder(id, session), session);
}

export async function listSaleOrders(filters, session) {
  await expireExpiredReservations();
  const where = { ...saleOrderAccessWhere(session) };
  const text = String(filters.q || "").trim();
  if (text) {
    const phoneDigits = text.replace(/\D/g, "");
    where.OR = [
      { number: { contains: text } },
      { observation: { contains: text } },
      { customer: { name: { contains: text } } },
      { customer: { phone: { contains: text } } },
      { customer: { phones: { some: { phone: { contains: text } } } } },
      ...(phoneDigits ? [{ customer: { phones: { some: { digits: { contains: phoneDigits } } } } }] : []),
      { customer: { document: { contains: text } } },
      { items: { some: { product: { serialOnyx: { contains: text } } } } },
    ];
  }
  if (filters.status) where.status = String(filters.status);
  if (filters.customerId) where.customerId = parseId(filters.customerId);
  if (filters.sellerId && canViewAllSaleOrders(session.role)) {
    where.sellerId = parseId(filters.sellerId);
  }

  const pagination = parsePagination(filters);
  const [total, items] = await Promise.all([
    prisma.saleOrder.count({ where }),
    prisma.saleOrder.findMany({
      where,
      include: {
        customer: { select: { id: true, name: true, phone: true } },
        unit: { select: unitSelect },
        seller: { select: userNameSelect },
        createdBy: { select: userNameSelect },
        items: {
          where: { status: { not: SALE_ORDER_ITEM_STATUSES.REMOVED } },
          include: {
            product: {
              select: {
                id: true,
                serialOnyx: true,
                catalogModel: { select: { commercialName: true } },
              },
            },
          },
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: pagination.skip,
      take: pagination.take,
    }),
  ]);

  return paginationResult(items.map((item) => serializeSaleOrder(item, session)), total, pagination);
}

export async function listSaleSellers(session) {
  if (!canViewAllSaleOrders(session.role)) {
    return [{ id: Number(session.id), name: session.name }];
  }
  const unitFilter = isAdminRole(session.role)
    ? {}
    : { unitId: { in: (session.units || []).map((unit) => unit.id) } };
  return prisma.user.findMany({
    where: {
      OR: [
        { active: true, role: { in: [ROLES.ADMIN, ROLES.GESTOR, ROLES.SELLER, ROLES.TECHNICIAN] } },
        { saleOrdersAsSeller: { some: unitFilter } },
      ],
    },
    select: userNameSelect,
    orderBy: { name: "asc" },
  });
}

export async function createSaleOrder(payload, user) {
  const unitId = requireActiveUnit(user);
  const customerId = parseId(payload.customerId);
  const customer = await prisma.customer.findUnique({ where: { id: customerId } });
  if (!customer) throw notFound("Cliente não encontrado.");
  const seller = await resolveSeller(payload, user);
  const conversation = await resolveConversation(payload, customer.id, user);

  const created = await prisma.$transaction(async (tx) => {
    const order = await tx.saleOrder.create({
      data: {
        number: `TMP-${Date.now()}-${user.id}`,
        customerId,
        unitId,
        sellerId: seller.id,
        conversationId: conversation?.id || null,
        status: SALE_ORDER_STATUSES.INTEREST,
        observation: emptyToNull(payload.observation),
        createdById: user.id,
      },
    });
    const number = formatSaleOrderNumber(order.id);
    await tx.saleOrder.update({ where: { id: order.id }, data: { number } });
    await addEvent(tx, {
      saleOrderId: order.id,
      type: SALE_ORDER_EVENT_TYPES.OPEN,
      message: [
        seller.id === user.id
          ? `Venda ${number} aberta para ${customer.name}.`
          : `Venda ${number} aberta para ${customer.name} e vinculada a ${seller.name}.`,
        conversation ? `Origem: conversa #${conversation.id}.` : null,
      ].filter(Boolean).join(" "),
      userId: user.id,
    });
    return order.id;
  });

  await writeAudit({
    userId: user.id,
    action: "SALE_ORDER_CREATED",
    entity: "sale_order",
    entityId: created,
    newData: { customerId, unitId, sellerId: seller.id, conversationId: conversation?.id || null },
  });

  return getSaleOrder(created, user);
}

async function findOpenSaleOrderItem(productId, { lockingOnly = false, excludeOrderId } = {}) {
  return prisma.saleOrderItem.findFirst({
    where: {
      productId: Number(productId),
      status: { in: lockingOnly ? LOCKING_ITEM_STATUSES : ACTIVE_ITEM_STATUSES },
      saleOrder: { status: { notIn: SALE_ORDER_CLOSED_STATUSES }, closedAt: null },
      ...(excludeOrderId ? { saleOrderId: { not: Number(excludeOrderId) } } : {}),
    },
    include: { saleOrder: { select: { id: true, number: true, sellerId: true } } },
    orderBy: { createdAt: "desc" },
  });
}

export { findOpenSaleOrderItem };

async function findLockingItem(productId, excludeOrderId) {
  return findOpenSaleOrderItem(productId, { lockingOnly: true, excludeOrderId });
}

export async function addSaleOrderItem(orderId, productId, user) {
  const order = await getRawOrder(orderId, user);
  assertCanOperate(user, order);
  assertOpen(order);
  const product = await getProduct(productId);
  if (product.unitId !== order.unitId) {
    throw forbidden("Troque para a unidade deste produto para incluí-lo na venda.");
  }
  if (product.status !== STATUSES.AVAILABLE) {
    throw conflict("Só é possível incluir produtos disponíveis. Reserve pelo fluxo desta venda.");
  }
  const locked = await findOpenSaleOrderItem(product.id, { excludeOrderId: order.id });
  if (locked) {
    throw conflict(lockingConflictMessage(user, locked));
  }

  const existing = order.items.find((item) => item.productId === product.id);
  if (existing && existing.status !== SALE_ORDER_ITEM_STATUSES.REMOVED) {
    throw conflict("Este produto já está nesta venda.");
  }

  if (existing) {
    await prisma.saleOrderItem.update({
      where: { id: existing.id },
      data: {
        status: SALE_ORDER_ITEM_STATUSES.INTEREST,
        cashPrice: product.cashPrice,
        saleId: null,
        warrantyMonths: null,
        invoiceNumber: null,
        reservedAt: null,
        reservedUntil: null,
        soldAt: null,
        soldById: null,
      },
    });
  } else {
    await prisma.saleOrderItem.create({
      data: {
        saleOrderId: order.id,
        productId: product.id,
        status: SALE_ORDER_ITEM_STATUSES.INTEREST,
        cashPrice: product.cashPrice,
      },
    });
  }

  await addEvent(prisma, {
    saleOrderId: order.id,
    type: SALE_ORDER_EVENT_TYPES.PRODUCT,
    message: `Produto ${formatProductId(product.id)} (${product.commercialName || product.serialOnyx}) incluído como interesse.`,
    userId: user.id,
  });
  await persistDerivedStatus(prisma, order.id);
  return getSaleOrder(order.id, user);
}

export async function removeSaleOrderItem(orderId, itemId, user) {
  const order = await getRawOrder(orderId, user);
  assertCanOperate(user, order);
  assertOpen(order);
  const item = order.items.find((entry) => entry.id === Number(itemId));
  if (!item) throw notFound("Produto não encontrado nesta venda.");
  if (item.status === SALE_ORDER_ITEM_STATUSES.SOLD) {
    throw conflict("Não é possível remover um produto já vendido.");
  }
  if (item.status === SALE_ORDER_ITEM_STATUSES.REMOVED) {
    return serializeSaleOrder(order, user);
  }

  if (item.status === SALE_ORDER_ITEM_STATUSES.RESERVED || item.status === SALE_ORDER_ITEM_STATUSES.ORDERED) {
    await prisma.saleOrderItem.update({
      where: { id: item.id },
      data: {
        status: SALE_ORDER_ITEM_STATUSES.REMOVED,
        reservedAt: null,
        reservedUntil: null,
      },
    });
    const { unreserveProduct } = await import("./stock");
    await unreserveProduct(item.productId, `Liberado ao remover da venda ${order.number}.`, user, { fromSaleOrder: true });
  } else {
    await prisma.saleOrderItem.update({
      where: { id: item.id },
      data: {
        status: SALE_ORDER_ITEM_STATUSES.REMOVED,
        reservedAt: null,
        reservedUntil: null,
      },
    });
  }
  await addEvent(prisma, {
    saleOrderId: order.id,
    type: SALE_ORDER_EVENT_TYPES.PRODUCT,
    message: `Produto ${formatProductId(item.productId)} removido da venda.`,
    userId: user.id,
  });
  await persistDerivedStatus(prisma, order.id);
  return getSaleOrder(order.id, user);
}

export async function reserveSaleOrderItem(orderId, itemId, reservedUntilValue, user) {
  const order = await getRawOrder(orderId, user);
  assertCanOperate(user, order);
  assertOpen(order);
  const item = order.items.find((entry) => entry.id === Number(itemId));
  if (!item) throw notFound("Produto não encontrado nesta venda.");
  if (item.status === SALE_ORDER_ITEM_STATUSES.SOLD) throw conflict("Este produto já foi vendido.");
  if (item.status === SALE_ORDER_ITEM_STATUSES.REMOVED) throw conflict("Reinclua o produto antes de reservá-lo.");
  const reservedUntil = parseReservedUntil(reservedUntilValue);
  if (item.status === SALE_ORDER_ITEM_STATUSES.RESERVED || item.status === SALE_ORDER_ITEM_STATUSES.ORDERED) {
    await prisma.saleOrderItem.update({
      where: { id: item.id },
      data: { reservedUntil },
    });
    await addEvent(prisma, {
      saleOrderId: order.id,
      type: SALE_ORDER_EVENT_TYPES.RESERVE,
      message: `Prazo da reserva do produto ${formatProductId(item.productId)} atualizado até ${formatDate(reservedUntil)}.`,
      userId: user.id,
    });
    return getSaleOrder(order.id, user);
  }

  const locked = await findLockingItem(item.productId, order.id);
  if (locked) throw conflict(lockingConflictMessage(user, locked, true));

  const { reserveProduct } = await import("./stock");
  await reserveProduct(item.productId, `Reservado para a venda ${order.number} até ${formatDate(reservedUntil)}.`, user, { fromSaleOrder: true });

  const nextStatus =
    order.orderedAt || order.status === SALE_ORDER_STATUSES.ORDER || order.status === SALE_ORDER_STATUSES.PARTIAL
      ? SALE_ORDER_ITEM_STATUSES.ORDERED
      : SALE_ORDER_ITEM_STATUSES.RESERVED;

  await prisma.saleOrderItem.update({
    where: { id: item.id },
    data: { status: nextStatus, reservedAt: new Date(), reservedUntil },
  });
  await addEvent(prisma, {
    saleOrderId: order.id,
    type: SALE_ORDER_EVENT_TYPES.RESERVE,
    message: `Produto ${formatProductId(item.productId)} reservado para ${order.customer.name} até ${formatDate(reservedUntil)}.`,
    userId: user.id,
  });
  await persistDerivedStatus(prisma, order.id);
  return getSaleOrder(order.id, user);
}

export async function unreserveSaleOrderItem(orderId, itemId, user) {
  const order = await getRawOrder(orderId, user);
  assertCanOperate(user, order);
  assertOpen(order);
  const item = order.items.find((entry) => entry.id === Number(itemId));
  if (!item) throw notFound("Produto não encontrado nesta venda.");
  if (item.status !== SALE_ORDER_ITEM_STATUSES.RESERVED && item.status !== SALE_ORDER_ITEM_STATUSES.ORDERED) {
    throw conflict("Este produto não está reservado nesta venda.");
  }

  const { unreserveProduct } = await import("./stock");
  await prisma.saleOrderItem.update({
    where: { id: item.id },
    data: clearReservationData(),
  });
  await unreserveProduct(item.productId, `Reserva liberada da venda ${order.number}.`, user, { fromSaleOrder: true });
  await addEvent(prisma, {
    saleOrderId: order.id,
    type: SALE_ORDER_EVENT_TYPES.RESERVE,
    message: `Reserva do produto ${formatProductId(item.productId)} liberada.`,
    userId: user.id,
  });
  await persistDerivedStatus(prisma, order.id);
  return getSaleOrder(order.id, user);
}

export async function generateSaleOrder(orderId, user) {
  const order = await getRawOrder(orderId, user);
  assertCanOperate(user, order);
  assertOpen(order);
  const reservable = order.items.filter((item) =>
    [SALE_ORDER_ITEM_STATUSES.RESERVED, SALE_ORDER_ITEM_STATUSES.ORDERED].includes(item.status),
  );
  if (!reservable.length) {
    throw validationError("Reserve ao menos um produto antes de gerar o pedido de venda.");
  }

  await prisma.saleOrderItem.updateMany({
    where: {
      saleOrderId: order.id,
      status: SALE_ORDER_ITEM_STATUSES.RESERVED,
    },
    data: { status: SALE_ORDER_ITEM_STATUSES.ORDERED },
  });
  await prisma.saleOrder.update({
    where: { id: order.id },
    data: {
      status: SALE_ORDER_STATUSES.ORDER,
      orderedAt: order.orderedAt || new Date(),
    },
  });
  await addEvent(prisma, {
    saleOrderId: order.id,
    type: SALE_ORDER_EVENT_TYPES.ORDER,
    message: `Pedido de venda gerado com ${reservable.length} produto(s). Aguardando baixa no caixa.`,
    userId: user.id,
  });
  await writeAudit({
    userId: user.id,
    action: "SALE_ORDER_GENERATED",
    entity: "sale_order",
    entityId: order.id,
  });
  return getSaleOrder(order.id, user);
}

export async function checkoutSaleOrder(orderId, payload, user) {
  if (!can(user.role, PERMISSIONS.SALE_CHECKOUT)) {
    throw forbidden("Somente o caixa pode concretizar a venda e dar baixa no estoque.");
  }
  const order = await getRawOrder(orderId, user);
  assertOpen(order);
  if (!order.orderedAt && order.status !== SALE_ORDER_STATUSES.ORDER && order.status !== SALE_ORDER_STATUSES.PARTIAL) {
    throw validationError("Gere o pedido de venda antes de pedir a baixa no caixa.");
  }

  const requested = Array.isArray(payload.items) ? payload.items : [];
  if (!requested.length) throw validationError("Informe os produtos para baixa.");

  const invoiceFallback = String(payload.invoiceNumber || "").trim();
  const { exitProduct } = await import("./stock");

  for (const entry of requested) {
    const item = order.items.find((row) => row.id === Number(entry.itemId || entry.id));
    if (!item) throw notFound("Produto do pedido não encontrado.");
    if (item.status !== SALE_ORDER_ITEM_STATUSES.ORDERED && item.status !== SALE_ORDER_ITEM_STATUSES.RESERVED) {
      throw conflict(`O produto ${formatProductId(item.productId)} não está pronto para baixa.`);
    }
    const invoiceNumber = String(entry.invoiceNumber || invoiceFallback || "").trim();
    const liveProduct = await getProduct(item.productId);
    await prisma.saleOrderItem.update({
      where: { id: item.id },
      data: { cashPrice: liveProduct.cashPrice },
    });
    await exitProduct({
      productId: item.productId,
      reason: EXIT_REASONS.SALE,
      observation: `Baixa do pedido ${order.number}.`,
      customerId: order.customerId,
      warrantyMonths: entry.warrantyMonths,
      invoiceNumber,
      soldAt: payload.soldAt,
      user,
      fromSaleOrder: true,
    });
  }

  await addEvent(prisma, {
    saleOrderId: order.id,
    type: SALE_ORDER_EVENT_TYPES.CHECKOUT,
    message: `Caixa deu baixa em ${requested.length} produto(s).`,
    userId: user.id,
  });
  await persistDerivedStatus(prisma, order.id);
  return getSaleOrder(order.id, user);
}

export async function closeSaleOrder(orderId, payload, user) {
  const order = await getRawOrder(orderId, user);
  assertCanOperate(user, order);
  assertOpen(order);
  const reason = String(payload.reason || SALE_ORDER_STATUSES.CANCELLED);
  if (![SALE_ORDER_STATUSES.LOST, SALE_ORDER_STATUSES.CANCELLED].includes(reason)) {
    throw validationError("Informe se a venda foi perdida ou cancelada.");
  }
  const note = emptyToNull(payload.message) || (reason === SALE_ORDER_STATUSES.LOST ? "Venda perdida." : "Venda cancelada.");

  const toRelease = order.items.filter((item) =>
    [SALE_ORDER_ITEM_STATUSES.RESERVED, SALE_ORDER_ITEM_STATUSES.ORDERED].includes(item.status),
  );
  if (toRelease.length) {
    const { unreserveProduct } = await import("./stock");
    for (const item of toRelease) {
      await prisma.saleOrderItem.update({
        where: { id: item.id },
        data: clearReservationData(),
      });
      await unreserveProduct(item.productId, `${note} · ${order.number}`, user, { fromSaleOrder: true });
    }
  }

  const sold = order.items.filter((item) => item.status === SALE_ORDER_ITEM_STATUSES.SOLD);
  const nextStatus = sold.length ? SALE_ORDER_STATUSES.PARTIAL : reason;
  await prisma.saleOrder.update({
    where: { id: order.id },
    data: { status: nextStatus, closedAt: new Date() },
  });
  await addEvent(prisma, {
    saleOrderId: order.id,
    type: SALE_ORDER_EVENT_TYPES.CLOSE,
    message: note,
    userId: user.id,
  });
  await writeAudit({
    userId: user.id,
    action: "SALE_ORDER_CLOSED",
    entity: "sale_order",
    entityId: order.id,
    newData: { status: nextStatus },
  });
  return getSaleOrder(order.id, user);
}

export async function addSaleOrderNote(orderId, message, user) {
  const order = await getRawOrder(orderId, user);
  const text = String(message || "").trim();
  if (!text) throw validationError("Escreva um comentário.");
  await addEvent(prisma, {
    saleOrderId: order.id,
    type: SALE_ORDER_EVENT_TYPES.NOTE,
    message: text,
    userId: user.id,
  });
  return getSaleOrder(order.id, user);
}

export async function syncSaleOrderAfterUnreserve(productId, user) {
  const item = await prisma.saleOrderItem.findFirst({
    where: {
      productId: Number(productId),
      status: { in: LOCKING_ITEM_STATUSES },
      saleOrder: { closedAt: null, status: { notIn: SALE_ORDER_CLOSED_STATUSES } },
    },
  });
  if (!item) return;
  await prisma.saleOrderItem.update({
    where: { id: item.id },
    data: clearReservationData(),
  });
  await addEvent(prisma, {
    saleOrderId: item.saleOrderId,
    type: SALE_ORDER_EVENT_TYPES.RESERVE,
    message: `Reserva do produto ${formatProductId(productId)} liberada no estoque.`,
    userId: user.id,
  });
  await persistDerivedStatus(prisma, item.saleOrderId);
}

export async function syncSaleOrderAfterSale(productId, user) {
  const item = await prisma.saleOrderItem.findFirst({
    where: {
      productId: Number(productId),
      status: { in: [...LOCKING_ITEM_STATUSES, SALE_ORDER_ITEM_STATUSES.INTEREST] },
      saleOrder: { closedAt: null, status: { notIn: SALE_ORDER_CLOSED_STATUSES } },
    },
    orderBy: { createdAt: "desc" },
  });
  if (!item) return;
  const sale = await getLatestSale(productId);
  await prisma.saleOrderItem.update({
    where: { id: item.id },
    data: {
      status: SALE_ORDER_ITEM_STATUSES.SOLD,
      cashPrice: sale?.cashPrice ?? item.cashPrice,
      saleId: sale?.id || null,
      warrantyMonths: sale?.warrantyMonths || null,
      invoiceNumber: sale?.invoiceNumber || null,
      soldAt: sale?.soldAt || new Date(),
      soldById: user.id,
    },
  });
  await persistDerivedStatus(prisma, item.saleOrderId);
}
