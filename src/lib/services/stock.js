import { prisma } from "../db";
import { conflict, validationError } from "../errors";
import { writeAudit, writeMovement } from "../audit";
import {
  CLOSED_STATUSES,
  EXIT_REASONS,
  EXIT_REASON_TO_STATUS,
  MOVEMENT_TYPES,
  STATUSES,
} from "../constants";
import { getProduct } from "./products";

export async function exitProduct({ productId, reason, observation, user }) {
  const product = await getProduct(productId);
  if (CLOSED_STATUSES.includes(product.status) && product.status !== STATUSES.RETURNED) {
    throw conflict("Não é permitido dar baixa em produto vendido, descartado ou transferido.");
  }
  if (product.status === STATUSES.SOLD || product.status === STATUSES.TRANSFERRED || product.status === STATUSES.DISCARDED) {
    throw conflict("Não é permitido dar baixa em produto vendido, descartado ou transferido.");
  }

  if (!Object.values(EXIT_REASONS).includes(reason)) {
    throw validationError("Informe um motivo de saída válido.");
  }
  if (reason === EXIT_REASONS.OTHER && !String(observation || "").trim()) {
    throw validationError("Informe uma observação para o motivo Outro.");
  }

  const newStatus = EXIT_REASON_TO_STATUS[reason];
  const type = reason === EXIT_REASONS.TRANSFER ? MOVEMENT_TYPES.TRANSFER : MOVEMENT_TYPES.EXIT;

  const updated = await prisma.product.update({
    where: { id: product.id },
    data: { status: newStatus },
    include: {
      category: true,
      line: true,
      images: true,
    },
  });

  await writeMovement({
    productId: product.id,
    type,
    reason,
    previousStatus: product.status,
    newStatus,
    observation,
    userId: user.id,
  });

  await writeAudit({
    userId: user.id,
    action: "STOCK_EXIT",
    entity: "product",
    entityId: product.id,
    oldData: { status: product.status },
    newData: { status: newStatus, reason, observation },
  });

  return updated;
}

export async function reserveProduct(productId, observation, user) {
  const product = await getProduct(productId);
  if (product.status !== STATUSES.AVAILABLE) {
    throw conflict("Somente produtos disponíveis podem ser reservados.");
  }

  const updated = await prisma.product.update({
    where: { id: product.id },
    data: { status: STATUSES.RESERVED },
  });

  await writeMovement({
    productId: product.id,
    type: MOVEMENT_TYPES.RESERVE,
    previousStatus: product.status,
    newStatus: STATUSES.RESERVED,
    observation,
    userId: user.id,
  });

  await writeAudit({
    userId: user.id,
    action: "STOCK_RESERVE",
    entity: "product",
    entityId: product.id,
    oldData: { status: product.status },
    newData: { status: STATUSES.RESERVED },
  });

  return updated;
}

export async function unreserveProduct(productId, observation, user) {
  const product = await getProduct(productId);
  if (product.status !== STATUSES.RESERVED) {
    throw conflict("Este produto não está reservado.");
  }

  const updated = await prisma.product.update({
    where: { id: product.id },
    data: { status: STATUSES.AVAILABLE },
  });

  await writeMovement({
    productId: product.id,
    type: MOVEMENT_TYPES.UNRESERVE,
    previousStatus: product.status,
    newStatus: STATUSES.AVAILABLE,
    observation,
    userId: user.id,
  });

  await writeAudit({
    userId: user.id,
    action: "STOCK_UNRESERVE",
    entity: "product",
    entityId: product.id,
    oldData: { status: product.status },
    newData: { status: STATUSES.AVAILABLE },
  });

  return updated;
}

export async function listMovements(filters = {}) {
  const { q, type, from, to, page = 1, pageSize = 30, productId } = filters;
  const where = {};

  if (productId) where.productId = Number(productId);
  if (type) where.type = type;
  if (from || to) {
    where.createdAt = {};
    if (from) where.createdAt.gte = new Date(from);
    if (to) {
      const end = new Date(to);
      end.setHours(23, 59, 59, 999);
      where.createdAt.lte = end;
    }
  }
  if (q) {
    const token = String(q).trim();
    const numeric = Number(token.replace(/^#/, ""));
    where.OR = [
      { observation: { contains: token } },
      { reason: { contains: token } },
      { product: { serialOnyx: { contains: token } } },
      { product: { supplierModelCode: { contains: token } } },
      { product: { ean: { contains: token } } },
      ...(Number.isInteger(numeric) && numeric > 0 ? [{ productId: numeric }] : []),
    ];
  }

  const take = Math.min(Number(pageSize) || 30, 100);
  const skip = (Math.max(Number(page) || 1, 1) - 1) * take;

  const [total, items] = await Promise.all([
    prisma.stockMovement.count({ where }),
    prisma.stockMovement.findMany({
      where,
      include: {
        user: { select: { id: true, name: true } },
        product: {
          include: {
            category: true,
            images: { where: { isPrimary: true }, take: 1 },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take,
    }),
  ]);

  return { items, total, page: Math.max(Number(page) || 1, 1), pageSize: take };
}
