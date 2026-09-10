import { prisma } from "../db";
import { conflict, forbidden, validationError } from "../errors";
import { writeAudit, writeMovement } from "../audit";
import {
  CLOSED_STATUSES,
  EXIT_REASONS,
  EXIT_REASON_TO_STATUS,
  MOVEMENT_TYPES,
  STATUSES,
} from "../constants";
import { formatProductId } from "../format";
import { parseProductIds } from "../validations";
import { getProduct, movementUnitFields } from "./products";
import { resolveProductLocation } from "./locations";
import {
  assertProductInActiveUnit,
  assertProductWritable,
  getUnitOrThrow,
  movementUnitWhere,
  requireActiveUnit,
  unitSelect,
} from "../units";

const transferProductInclude = {
  category: true,
  line: true,
  catalogModel: true,
  images: { where: { isPrimary: true }, take: 1 },
  unit: { select: unitSelect },
  transferToUnit: { select: unitSelect },
};

function assertOpenForExit(product) {
  if (product.status === STATUSES.IN_TRANSIT) {
    throw conflict("Este produto está em trânsito entre unidades. Conclua ou cancele a transferência.");
  }
  if (CLOSED_STATUSES.includes(product.status) && product.status !== STATUSES.RETURNED) {
    throw conflict("Não é permitido dar baixa em produto vendido, descartado ou transferido.");
  }
  if (product.status === STATUSES.SOLD || product.status === STATUSES.TRANSFERRED || product.status === STATUSES.DISCARDED) {
    throw conflict("Não é permitido dar baixa em produto vendido, descartado ou transferido.");
  }
}

export async function exitProduct({ productId, reason, observation, user }) {
  const product = await getProduct(productId);
  assertProductWritable(user, product);
  assertOpenForExit(product);

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
    ...movementUnitFields(product),
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
  assertProductWritable(user, product);
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
    ...movementUnitFields(product),
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
  assertProductWritable(user, product);
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
    ...movementUnitFields(product),
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

async function assertBatchProducts(ids, check) {
  const found = await prisma.product.findMany({
    where: { id: { in: ids } },
    select: { id: true, status: true, unitId: true, transferToUnitId: true },
  });
  const byId = new Map(found.map((item) => [item.id, item]));
  const problems = [];

  for (const id of ids) {
    const product = byId.get(id);
    const label = formatProductId(id);
    if (!product) {
      problems.push(`${label} não encontrado.`);
      continue;
    }
    const error = check(product);
    if (error) problems.push(`${label} ${error}.`);
  }

  if (problems.length) {
    const shown = problems.slice(0, 8);
    throw validationError(
      `Não foi possível concluir o lote. ${shown.join(" ")}${problems.length > 8 ? ` (+${problems.length - 8})` : ""}`,
    );
  }
}

async function mapTransfers(ids, fn) {
  const products = [];
  for (const productId of ids) {
    products.push(await fn(productId));
  }
  return products;
}

export async function sendTransfer({ productId, toUnitId, observation, user }) {
  const product = await getProduct(productId);
  assertProductInActiveUnit(user, product);
  if (product.status !== STATUSES.AVAILABLE) {
    throw conflict("Somente produtos disponíveis podem ser enviados para outra unidade.");
  }

  const destination = await getUnitOrThrow(toUnitId);
  if (destination.id === product.unitId) {
    throw validationError("Selecione uma unidade de destino diferente da origem.");
  }

  const updated = await prisma.product.update({
    where: { id: product.id },
    data: {
      status: STATUSES.IN_TRANSIT,
      transferToUnitId: destination.id,
      locationId: null,
    },
  });

  await writeMovement({
    productId: product.id,
    type: MOVEMENT_TYPES.TRANSFER_SEND,
    previousStatus: product.status,
    newStatus: STATUSES.IN_TRANSIT,
    observation: observation || `Enviado para ${destination.name}`,
    previousLocationId: product.locationId,
    newLocationId: null,
    previousUnitId: product.unitId,
    newUnitId: destination.id,
    userId: user.id,
  });

  await writeAudit({
    userId: user.id,
    action: "STOCK_TRANSFER_SEND",
    entity: "product",
    entityId: product.id,
    oldData: { status: product.status, unitId: product.unitId, locationId: product.locationId },
    newData: { status: STATUSES.IN_TRANSIT, transferToUnitId: destination.id },
  });

  return getProduct(updated.id);
}

export async function receiveTransfer({ productId, observation, user, locationId, locationTypeId }) {
  const product = await getProduct(productId);
  const unitId = requireActiveUnit(user);
  if (product.status !== STATUSES.IN_TRANSIT || product.transferToUnitId !== unitId) {
    throw forbidden("Não há transferência pendente para esta unidade.");
  }

  const location = await resolveProductLocation(
    { locationId, locationTypeId },
    { unitId },
  );

  const originUnitId = product.unitId;
  const updated = await prisma.product.update({
    where: { id: product.id },
    data: {
      status: STATUSES.AVAILABLE,
      unitId,
      transferToUnitId: null,
      locationId: location === undefined ? null : location?.id ?? null,
    },
  });

  await writeMovement({
    productId: product.id,
    type: MOVEMENT_TYPES.TRANSFER_RECEIVE,
    previousStatus: product.status,
    newStatus: STATUSES.AVAILABLE,
    observation: observation || "Recebimento confirmado",
    previousLocationId: null,
    newLocationId: location === undefined ? null : location?.id ?? null,
    previousUnitId: originUnitId,
    newUnitId: unitId,
    userId: user.id,
  });

  await writeAudit({
    userId: user.id,
    action: "STOCK_TRANSFER_RECEIVE",
    entity: "product",
    entityId: product.id,
    oldData: { status: product.status, unitId: originUnitId },
    newData: { status: STATUSES.AVAILABLE, unitId },
  });

  return getProduct(updated.id);
}

async function returnFromTransit({ productId, user, type, action, defaultObservation, errorMessage }) {
  const product = await getProduct(productId);
  const unitId = requireActiveUnit(user);
  if (product.status !== STATUSES.IN_TRANSIT) {
    throw conflict("Este produto não está em trânsito.");
  }

  const isOrigin = product.unitId === unitId;
  const isDestination = product.transferToUnitId === unitId;
  if (type === MOVEMENT_TYPES.TRANSFER_CANCEL && !isOrigin) {
    throw forbidden(errorMessage);
  }
  if (type === MOVEMENT_TYPES.TRANSFER_REFUSE && !isDestination) {
    throw forbidden(errorMessage);
  }

  const destinationName = product.transferToUnit?.name;
  const updated = await prisma.product.update({
    where: { id: product.id },
    data: {
      status: STATUSES.AVAILABLE,
      transferToUnitId: null,
    },
  });

  await writeMovement({
    productId: product.id,
    type,
    previousStatus: product.status,
    newStatus: STATUSES.AVAILABLE,
    observation: defaultObservation + (destinationName ? ` (${destinationName})` : ""),
    previousUnitId: product.unitId,
    newUnitId: product.transferToUnitId,
    userId: user.id,
  });

  await writeAudit({
    userId: user.id,
    action,
    entity: "product",
    entityId: product.id,
    oldData: { status: product.status, transferToUnitId: product.transferToUnitId },
    newData: { status: STATUSES.AVAILABLE, transferToUnitId: null },
  });

  return getProduct(updated.id);
}

export async function cancelTransfer({ productId, observation, user }) {
  return returnFromTransit({
    productId,
    user,
    type: MOVEMENT_TYPES.TRANSFER_CANCEL,
    action: "STOCK_TRANSFER_CANCEL",
    defaultObservation: observation || "Envio cancelado pela origem",
    errorMessage: "Somente a unidade de origem pode cancelar o envio.",
  });
}

export async function refuseTransfer({ productId, observation, user }) {
  return returnFromTransit({
    productId,
    user,
    type: MOVEMENT_TYPES.TRANSFER_REFUSE,
    action: "STOCK_TRANSFER_REFUSE",
    defaultObservation: observation || "Recebimento recusado pelo destino",
    errorMessage: "Somente a unidade de destino pode recusar o recebimento.",
  });
}

export async function sendTransfers({ productIds, toUnitId, observation, user }) {
  const ids = parseProductIds({ productIds });
  if (!toUnitId) throw validationError("Informe a unidade de destino.");
  const destination = await getUnitOrThrow(toUnitId);
  const unitId = requireActiveUnit(user);

  await assertBatchProducts(ids, (product) => {
    if (product.unitId !== unitId) return "não pertence à unidade ativa";
    if (product.status !== STATUSES.AVAILABLE) return "não está disponível para envio";
    if (product.unitId === destination.id) return "já está na unidade de destino";
    return null;
  });

  return mapTransfers(ids, (productId) => sendTransfer({ productId, toUnitId: destination.id, observation, user }));
}

export async function receiveTransfers({ productIds, observation, user, locationId, locationTypeId }) {
  const ids = parseProductIds({ productIds });
  const unitId = requireActiveUnit(user);

  await assertBatchProducts(ids, (product) => {
    if (product.status !== STATUSES.IN_TRANSIT || product.transferToUnitId !== unitId) {
      return "não tem transferência pendente para esta unidade";
    }
    return null;
  });

  return mapTransfers(ids, (productId) =>
    receiveTransfer({ productId, observation, user, locationId, locationTypeId }),
  );
}

export async function cancelTransfers({ productIds, observation, user }) {
  const ids = parseProductIds({ productIds });
  const unitId = requireActiveUnit(user);

  await assertBatchProducts(ids, (product) => {
    if (product.status !== STATUSES.IN_TRANSIT) return "não está em trânsito";
    if (product.unitId !== unitId) return "só pode ser cancelado pela unidade de origem";
    return null;
  });

  return mapTransfers(ids, (productId) => cancelTransfer({ productId, observation, user }));
}

export async function refuseTransfers({ productIds, observation, user }) {
  const ids = parseProductIds({ productIds });
  const unitId = requireActiveUnit(user);

  await assertBatchProducts(ids, (product) => {
    if (product.status !== STATUSES.IN_TRANSIT) return "não está em trânsito";
    if (product.transferToUnitId !== unitId) return "só pode ser recusado pela unidade de destino";
    return null;
  });

  return mapTransfers(ids, (productId) => refuseTransfer({ productId, observation, user }));
}

export async function listTransfers(session) {
  const unitId = requireActiveUnit(session);
  const [outgoing, incoming] = await Promise.all([
    prisma.product.findMany({
      where: { unitId, status: STATUSES.IN_TRANSIT },
      include: transferProductInclude,
      orderBy: { updatedAt: "desc" },
    }),
    prisma.product.findMany({
      where: { transferToUnitId: unitId, status: STATUSES.IN_TRANSIT },
      include: transferProductInclude,
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  return { outgoing, incoming };
}

export async function listMovements(filters = {}, session) {
  const { q, type, from, to, page = 1, pageSize = 30, productId } = filters;
  const unitId = requireActiveUnit(session);
  const where = {
    AND: [movementUnitWhere(unitId)],
  };

  if (productId) where.AND.push({ productId: Number(productId) });
  if (type) where.AND.push({ type });
  if (from || to) {
    const createdAt = {};
    if (from) createdAt.gte = new Date(from);
    if (to) {
      const end = new Date(to);
      end.setHours(23, 59, 59, 999);
      createdAt.lte = end;
    }
    where.AND.push({ createdAt });
  }
  if (q) {
    const token = String(q).trim();
    const numeric = Number(token.replace(/^#/, ""));
    where.AND.push({
      OR: [
        { observation: { contains: token } },
        { reason: { contains: token } },
        { product: { serialOnyx: { contains: token } } },
        { product: { supplierModelCode: { contains: token } } },
        { product: { ean: { contains: token } } },
        ...(Number.isInteger(numeric) && numeric > 0 ? [{ productId: numeric }] : []),
      ],
    });
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
            unit: { select: unitSelect },
          },
        },
        previousLocation: { include: { locationType: true } },
        newLocation: { include: { locationType: true } },
        previousUnit: { select: unitSelect },
        newUnit: { select: unitSelect },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take,
    }),
  ]);

  return { items, total, page: Math.max(Number(page) || 1, 1), pageSize: take };
}
