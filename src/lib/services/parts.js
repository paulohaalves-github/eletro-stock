import { prisma } from "../db";
import { conflict, forbidden, notFound, validationError } from "../errors";
import { writeAudit } from "../audit";
import {
  PART_MOVEMENT_TYPES,
  PART_TRANSFER_STATUSES,
  WORK_ORDER_PART_STATUSES,
  WORK_ORDER_STATUSES,
} from "../constants";
import { emptyToNull, parseId, toNumber } from "../validations";
import { getUnitOrThrow, requireActiveUnit, unitSelect } from "../units";
import { formatLocationPath } from "../format";

const locationInclude = { locationType: true };

const partInclude = {
  createdBy: { select: { id: true, name: true } },
  stocks: {
    include: {
      unit: { select: unitSelect },
      location: { include: locationInclude },
    },
  },
};

function parseQuantity(value) {
  const quantity = Math.trunc(toNumber(value, 0));
  if (quantity < 1) throw validationError("Informe uma quantidade válida.");
  return quantity;
}

async function resolveLocation(locationId, unitId) {
  const location = await prisma.location.findFirst({
    where: { id: parseId(locationId), unitId, active: true },
    include: locationInclude,
  });
  if (!location) throw validationError("Localização inválida para esta unidade.");
  return location;
}

export function serializePart(part, { unitId } = {}) {
  if (!part) return null;
  const stocks = part.stocks || [];
  const unitStocks = unitId ? stocks.filter((item) => item.unitId === unitId) : stocks;
  const quantityInUnit = unitStocks.reduce((sum, item) => sum + item.quantity, 0);
  const quantityTotal = stocks.reduce((sum, item) => sum + item.quantity, 0);
  return {
    ...part,
    stocks: unitId ? unitStocks : stocks,
    quantityInUnit,
    quantityTotal,
  };
}

export async function listParts({ q, active, page = 1, pageSize = 50 } = {}, session) {
  const unitId = requireActiveUnit(session);
  const where = {};
  if (active === true || active === "true") where.active = true;
  if (active === false || active === "false") where.active = false;
  const text = String(q || "").trim();
  if (text) {
    where.OR = [
      { code: { contains: text } },
      { name: { contains: text } },
      { description: { contains: text } },
    ];
  }

  const take = Math.min(Number(pageSize) || 50, 100);
  const skip = (Math.max(Number(page) || 1, 1) - 1) * take;

  const [total, rows] = await Promise.all([
    prisma.part.count({ where }),
    prisma.part.findMany({
      where,
      include: {
        stocks: {
          where: { unitId },
          include: { location: { include: locationInclude }, unit: { select: unitSelect } },
        },
      },
      orderBy: { name: "asc" },
      skip,
      take,
    }),
  ]);

  return {
    items: rows.map((item) => serializePart(item, { unitId })),
    total,
    page: Math.max(Number(page) || 1, 1),
    pageSize: take,
  };
}

export async function getPart(id, session) {
  const unitId = session ? requireActiveUnit(session) : null;
  const part = await prisma.part.findUnique({
    where: { id: Number(id) },
    include: {
      ...partInclude,
      movements: {
        take: 40,
        orderBy: { createdAt: "desc" },
        include: {
          user: { select: { id: true, name: true } },
          location: { include: locationInclude },
          toLocation: { include: locationInclude },
          unit: { select: unitSelect },
          toUnit: { select: unitSelect },
        },
      },
    },
  });
  if (!part) throw notFound("Peça não encontrada.");
  return serializePart(part, { unitId });
}

export async function createPart(payload, actor) {
  const code = String(payload.code || "").trim().toUpperCase();
  const name = String(payload.name || "").trim();
  if (!code) throw validationError("Informe o código da peça.");
  if (!name) throw validationError("Informe o nome da peça.");

  const exists = await prisma.part.findUnique({ where: { code } });
  if (exists) throw conflict("Já existe uma peça com este código.");

  const part = await prisma.part.create({
    data: {
      code,
      name,
      description: emptyToNull(payload.description),
      active: payload.active !== false,
      createdById: actor.id,
    },
  });

  await writeAudit({
    userId: actor.id,
    action: "PART_CREATED",
    entity: "part",
    entityId: part.id,
    newData: part,
  });
  return getPart(part.id, actor);
}

export async function updatePart(id, payload, actor) {
  const current = await prisma.part.findUnique({ where: { id: Number(id) } });
  if (!current) throw notFound("Peça não encontrada.");

  const data = {};
  if (payload.code !== undefined) {
    data.code = String(payload.code || "").trim().toUpperCase();
    if (!data.code) throw validationError("Informe o código da peça.");
  }
  if (payload.name !== undefined) {
    data.name = String(payload.name || "").trim();
    if (!data.name) throw validationError("Informe o nome da peça.");
  }
  if (payload.description !== undefined) data.description = emptyToNull(payload.description);
  if (payload.active !== undefined) data.active = Boolean(payload.active);

  if (data.code && data.code !== current.code) {
    const exists = await prisma.part.findFirst({ where: { code: data.code, id: { not: current.id } } });
    if (exists) throw conflict("Já existe uma peça com este código.");
  }

  const part = await prisma.part.update({ where: { id: current.id }, data });
  await writeAudit({
    userId: actor.id,
    action: "PART_UPDATED",
    entity: "part",
    entityId: part.id,
    oldData: current,
    newData: part,
  });
  return getPart(part.id, actor);
}

async function adjustStock(tx, { partId, unitId, locationId, delta, type, userId, observation, toUnitId, toLocationId, workOrderId }) {
  const current = await tx.partStock.findUnique({
    where: { partId_unitId_locationId: { partId, unitId, locationId } },
  });
  const previousQuantity = current?.quantity || 0;
  const newQuantity = previousQuantity + delta;
  if (newQuantity < 0) throw conflict("Quantidade insuficiente nesta localização.");

  if (current) {
    await tx.partStock.update({
      where: { id: current.id },
      data: { quantity: newQuantity },
    });
  } else {
    if (delta < 0) throw conflict("Quantidade insuficiente nesta localização.");
    await tx.partStock.create({
      data: { partId, unitId, locationId, quantity: newQuantity },
    });
  }

  await tx.partMovement.create({
    data: {
      partId,
      type,
      quantity: Math.abs(delta),
      previousQuantity,
      newQuantity,
      unitId,
      locationId,
      toUnitId: toUnitId ?? null,
      toLocationId: toLocationId ?? null,
      workOrderId: workOrderId ?? null,
      observation: observation || null,
      userId,
    },
  });

  return { previousQuantity, newQuantity };
}

export async function enterPartStock(payload, user) {
  const unitId = requireActiveUnit(user);
  const partId = parseId(payload.partId);
  const quantity = parseQuantity(payload.quantity);
  const location = await resolveLocation(payload.locationId, unitId);
  const part = await prisma.part.findUnique({ where: { id: partId } });
  if (!part || !part.active) throw validationError("Peça inválida ou inativa.");

  await prisma.$transaction((tx) =>
    adjustStock(tx, {
      partId,
      unitId,
      locationId: location.id,
      delta: quantity,
      type: PART_MOVEMENT_TYPES.ENTRY,
      userId: user.id,
      observation: emptyToNull(payload.observation) || `Entrada em ${formatLocationPath(location)}`,
    }),
  );

  return getPart(partId, user);
}

export async function movePartLocation(payload, user) {
  const unitId = requireActiveUnit(user);
  const partId = parseId(payload.partId);
  const quantity = parseQuantity(payload.quantity);
  const from = await resolveLocation(payload.fromLocationId, unitId);
  const to = await resolveLocation(payload.toLocationId, unitId);
  if (from.id === to.id) throw validationError("Escolha uma localização de destino diferente.");

  await prisma.$transaction(async (tx) => {
    await adjustStock(tx, {
      partId,
      unitId,
      locationId: from.id,
      delta: -quantity,
      type: PART_MOVEMENT_TYPES.LOCATION_CHANGE,
      userId: user.id,
      observation: `${formatLocationPath(from)} → ${formatLocationPath(to)}`,
      toLocationId: to.id,
    });
    await adjustStock(tx, {
      partId,
      unitId,
      locationId: to.id,
      delta: quantity,
      type: PART_MOVEMENT_TYPES.LOCATION_CHANGE,
      userId: user.id,
      toLocationId: to.id,
      observation: `${formatLocationPath(from)} → ${formatLocationPath(to)}`,
    });
  });

  return getPart(partId, user);
}

export async function sendPartTransfer(payload, user) {
  const unitId = requireActiveUnit(user);
  const partId = parseId(payload.partId);
  const quantity = parseQuantity(payload.quantity);
  const toUnit = await getUnitOrThrow(payload.toUnitId);
  if (toUnit.id === unitId) throw validationError("Escolha uma unidade de destino diferente.");
  const from = await resolveLocation(payload.locationId, unitId);

  const transfer = await prisma.$transaction(async (tx) => {
    await adjustStock(tx, {
      partId,
      unitId,
      locationId: from.id,
      delta: -quantity,
      type: PART_MOVEMENT_TYPES.TRANSFER_SEND,
      userId: user.id,
      toUnitId: toUnit.id,
      observation: emptyToNull(payload.observation),
    });
    return tx.partTransfer.create({
      data: {
        partId,
        quantity,
        fromUnitId: unitId,
        fromLocationId: from.id,
        toUnitId: toUnit.id,
        status: PART_TRANSFER_STATUSES.IN_TRANSIT,
        observation: emptyToNull(payload.observation),
        createdById: user.id,
      },
    });
  });

  return transfer;
}

export async function receivePartTransfer(id, payload, user) {
  const unitId = requireActiveUnit(user);
  const transfer = await prisma.partTransfer.findUnique({ where: { id: Number(id) } });
  if (!transfer) throw notFound("Transferência de peça não encontrada.");
  if (transfer.status !== PART_TRANSFER_STATUSES.IN_TRANSIT) {
    throw conflict("Esta transferência já foi concluída.");
  }
  if (transfer.toUnitId !== unitId) throw forbidden("Troque para a unidade de destino para receber as peças.");
  const location = await resolveLocation(payload.locationId, unitId);

  await prisma.$transaction(async (tx) => {
    await adjustStock(tx, {
      partId: transfer.partId,
      unitId,
      locationId: location.id,
      delta: transfer.quantity,
      type: PART_MOVEMENT_TYPES.TRANSFER_RECEIVE,
      userId: user.id,
      observation: emptyToNull(payload.observation),
    });
    await tx.partTransfer.update({
      where: { id: transfer.id },
      data: {
        status: PART_TRANSFER_STATUSES.RECEIVED,
        toLocationId: location.id,
        receivedById: user.id,
        observation: emptyToNull(payload.observation) ?? transfer.observation,
      },
    });
  });

  return getPart(transfer.partId, user);
}

export async function cancelOrRefusePartTransfer(id, { action, observation }, user) {
  const unitId = requireActiveUnit(user);
  const transfer = await prisma.partTransfer.findUnique({ where: { id: Number(id) } });
  if (!transfer) throw notFound("Transferência de peça não encontrada.");
  if (transfer.status !== PART_TRANSFER_STATUSES.IN_TRANSIT) {
    throw conflict("Esta transferência já foi concluída.");
  }

  const isCancel = action === "cancel";
  if (isCancel && transfer.fromUnitId !== unitId) {
    throw forbidden("Só a unidade de origem cancela o envio.");
  }
  if (!isCancel && transfer.toUnitId !== unitId) {
    throw forbidden("Só a unidade de destino recusa o envio.");
  }

  const type = isCancel ? PART_MOVEMENT_TYPES.TRANSFER_CANCEL : PART_MOVEMENT_TYPES.TRANSFER_REFUSE;
  const status = isCancel ? PART_TRANSFER_STATUSES.CANCELLED : PART_TRANSFER_STATUSES.REFUSED;

  await prisma.$transaction(async (tx) => {
    await adjustStock(tx, {
      partId: transfer.partId,
      unitId: transfer.fromUnitId,
      locationId: transfer.fromLocationId,
      delta: transfer.quantity,
      type,
      userId: user.id,
      observation: emptyToNull(observation),
    });
    await tx.partTransfer.update({
      where: { id: transfer.id },
      data: { status, observation: emptyToNull(observation) ?? transfer.observation },
    });
  });

  return { message: isCancel ? "Envio cancelado." : "Envio recusado." };
}

export async function listPartTransfers(session) {
  const unitId = requireActiveUnit(session);
  const items = await prisma.partTransfer.findMany({
    where: {
      status: PART_TRANSFER_STATUSES.IN_TRANSIT,
      OR: [{ fromUnitId: unitId }, { toUnitId: unitId }],
    },
    include: {
      part: true,
      fromUnit: { select: unitSelect },
      toUnit: { select: unitSelect },
      fromLocation: { include: locationInclude },
      createdBy: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  return items;
}

export async function listPartRequests({ status } = {}, session) {
  requireActiveUnit(session);
  const where = {};
  if (status) where.status = status;
  else where.status = WORK_ORDER_PART_STATUSES.REQUESTED;

  const items = await prisma.workOrderPart.findMany({
    where,
    include: {
      part: true,
      workOrder: {
        include: {
          customer: { select: { id: true, name: true, phone: true } },
          product: { include: { catalogModel: true } },
          unit: { select: unitSelect },
          labUnit: { select: unitSelect },
        },
      },
      requestedBy: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  return items.filter((item) => {
    const order = item.workOrder;
    if (!order) return false;
    if (session.role === "ADMINISTRADOR") return true;
    const ids = (session.units || []).map((unit) => unit.id);
    return ids.includes(order.unitId) || (order.labUnitId && ids.includes(order.labUnitId));
  });
}

export async function fulfillWorkOrderPart(id, payload, user) {
  const unitId = requireActiveUnit(user);
  const request = await prisma.workOrderPart.findUnique({
    where: { id: Number(id) },
    include: { part: true, workOrder: true },
  });
  if (!request) throw notFound("Solicitação não encontrada.");
  if (request.status !== WORK_ORDER_PART_STATUSES.REQUESTED) {
    throw conflict("Esta solicitação já foi tratada.");
  }
  const location = await resolveLocation(payload.locationId, unitId);

  await prisma.$transaction(async (tx) => {
    await adjustStock(tx, {
      partId: request.partId,
      unitId,
      locationId: location.id,
      delta: -request.quantity,
      type: PART_MOVEMENT_TYPES.OS_OUT,
      userId: user.id,
      workOrderId: request.workOrderId,
      observation: `${request.workOrder.number} · ${formatLocationPath(location)}`,
    });

    await tx.workOrderPart.update({
      where: { id: request.id },
      data: {
        status: WORK_ORDER_PART_STATUSES.FULFILLED,
        unitId,
        locationId: location.id,
        fulfilledById: user.id,
        fulfilledAt: new Date(),
        observation: emptyToNull(payload.observation) ?? request.observation,
      },
    });

    await tx.workOrderEvent.create({
      data: {
        workOrderId: request.workOrderId,
        type: "PECA_ATENDIDA",
        message: `Peça ${request.part.code} atendida (${request.quantity}) em ${formatLocationPath(location)}.`,
        userId: user.id,
      },
    });

    const pending = await tx.workOrderPart.count({
      where: { workOrderId: request.workOrderId, status: WORK_ORDER_PART_STATUSES.REQUESTED },
    });
    if (pending === 0 && request.workOrder.status === WORK_ORDER_STATUSES.WAITING_PART) {
      await tx.workOrder.update({
        where: { id: request.workOrderId },
        data: { status: WORK_ORDER_STATUSES.REPAIRING },
      });
    }
  });

  return { message: "Peça baixada do estoque e vinculada à OS." };
}

export async function refuseWorkOrderPart(id, payload, user) {
  const request = await prisma.workOrderPart.findUnique({
    where: { id: Number(id) },
    include: { part: true, workOrder: true },
  });
  if (!request) throw notFound("Solicitação não encontrada.");
  if (request.status !== WORK_ORDER_PART_STATUSES.REQUESTED) {
    throw conflict("Esta solicitação já foi tratada.");
  }
  const observation = String(payload.observation || "").trim();
  if (!observation) throw validationError("Informe o motivo da recusa.");

  await prisma.$transaction(async (tx) => {
    await tx.workOrderPart.update({
      where: { id: request.id },
      data: {
        status: WORK_ORDER_PART_STATUSES.REFUSED,
        fulfilledById: user.id,
        fulfilledAt: new Date(),
        observation,
      },
    });
    await tx.workOrderEvent.create({
      data: {
        workOrderId: request.workOrderId,
        type: "PECA_RECUSADA",
        message: `Peça ${request.part.code} recusada: ${observation}`,
        userId: user.id,
      },
    });
  });

  return { message: "Solicitação recusada." };
}
