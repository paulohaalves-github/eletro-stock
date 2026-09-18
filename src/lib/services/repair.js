import { prisma } from "../db";
import { conflict, forbidden, notFound, validationError } from "../errors";
import { writeAudit, writeMovement } from "../audit";
import {
  MOVEMENT_TYPES,
  SERVICE_PLACES,
  STATUSES,
  WORK_ORDER_CLOSED_STATUSES,
  WORK_ORDER_OPENABLE_STATUSES,
  WORK_ORDER_PART_STATUSES,
  WORK_ORDER_STATUSES,
  WORK_ORDER_STATUS_LABELS,
  WORK_ORDER_TYPES,
  WORK_ORDER_EVENT_TYPES,
  isStockRepair,
  resolveWorkOrderType,
} from "../constants";
import { emptyToNull, parseId, toNumber } from "../validations";
import { paginationResult, parsePagination } from "../pagination";
import {
  canViewWorkOrder,
  getLabUnit,
  requireActiveUnit,
  unitSelect,
  canViewProduct,
} from "../units";
import { movementUnitFields } from "./products";
import { getLatestSale, serializeSale } from "./sales";
import { formatLocationPath } from "../format";

const locationInclude = { locationType: true };

const workOrderInclude = {
  customer: true,
  sale: true,
  unit: { select: unitSelect },
  labUnit: { select: unitSelect },
  createdBy: { select: { id: true, name: true } },
  technician: { select: { id: true, name: true } },
  product: {
    include: {
      catalogModel: true,
      category: true,
      location: { include: locationInclude },
      unit: { select: unitSelect },
      images: { where: { isPrimary: true }, take: 1 },
    },
  },
  images: { orderBy: { createdAt: "desc" } },
  parts: {
    include: {
      part: true,
      requestedBy: { select: { id: true, name: true } },
      fulfilledBy: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  },
  events: {
    include: { user: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" },
  },
};

function formatWorkOrderNumber(id) {
  return `OS-${String(id).padStart(6, "0")}`;
}

function workOrderWhere(session) {
  if (session.role === "ADMINISTRADOR") return {};
  const ids = (session.units || []).map((unit) => unit.id);
  return {
    OR: [{ unitId: { in: ids } }, { labUnitId: { in: ids } }],
  };
}

export function serializeWorkOrder(order) {
  if (!order) return null;
  return {
    ...order,
    commercialName: order.product?.catalogModel?.commercialName || null,
    closed: WORK_ORDER_CLOSED_STATUSES.includes(order.status),
    events: order.events ? attachImagesToEvents(order) : order.events,
  };
}

function attachImagesToEvents(order) {
  const events = (order.events || []).map((event) => ({
    ...event,
    images: [],
  }));
  const images = [...(order.images || [])].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );

  for (const image of images) {
    const imageTime = new Date(image.createdAt).getTime();
    const ranked = events
      .map((event) => ({
        event,
        dt: Math.abs(new Date(event.createdAt).getTime() - imageTime),
        sameUser: event.userId === image.uploadedById ? 0 : 1,
      }))
      .sort((a, b) => a.sameUser - b.sameUser || a.dt - b.dt);
    const match = ranked.find((item) => item.dt <= 5 * 60 * 1000) || ranked[0];
    if (match) match.event.images.push(image);
  }

  return events;
}

async function addEvent(tx, { workOrderId, type, message, userId }) {
  return tx.workOrderEvent.create({
    data: { workOrderId, type, message, userId },
  });
}

function assertOpen(order) {
  if (WORK_ORDER_CLOSED_STATUSES.includes(order.status)) {
    throw conflict("Esta ordem de serviço já foi encerrada.");
  }
}

function parseLocalDay(value, hours, minutes, seconds, ms) {
  const text = String(value || "").trim();
  if (!text) return undefined;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (match) {
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), hours, minutes, seconds, ms);
  }
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return undefined;
  date.setHours(hours, minutes, seconds, ms);
  return date;
}

function dateRange(from, to) {
  if (!from && !to) return undefined;
  const range = {};
  const start = parseLocalDay(from, 0, 0, 0, 0);
  const end = parseLocalDay(to, 23, 59, 59, 999);
  if (start) range.gte = start;
  if (end) range.lte = end;
  return range.gte || range.lte ? range : undefined;
}

export async function listWorkOrders(
  { q, status, servicePlace, type, openedFrom, openedTo, closedFrom, closedTo, page = 1, pageSize } = {},
  session,
) {
  const where = { ...workOrderWhere(session) };
  if (status) where.status = status;
  if (servicePlace) where.servicePlace = servicePlace;
  const openedAt = dateRange(openedFrom, openedTo);
  if (openedAt) where.openedAt = openedAt;
  const closedAt = dateRange(closedFrom, closedTo);
  if (closedAt) where.closedAt = closedAt;
  const text = String(q || "").trim();
  if (text) {
    where.AND = [
      ...(where.AND || []),
      {
        OR: [
          { number: { contains: text } },
          { reportedDefect: { contains: text } },
          { customer: { name: { contains: text } } },
          { customer: { phone: { contains: text } } },
          { product: { serialOnyx: { contains: text } } },
        ],
      },
    ];
  }

  const countWhere = { ...where };
  if (type && Object.values(WORK_ORDER_TYPES).includes(type)) where.type = type;

  const pagination = parsePagination({ page, pageSize });
  const [total, rows, grouped] = await Promise.all([
    prisma.workOrder.count({ where }),
    prisma.workOrder.findMany({
      where,
      include: {
        customer: true,
        unit: { select: unitSelect },
        labUnit: { select: unitSelect },
        product: {
          include: {
            catalogModel: true,
            images: { where: { isPrimary: true }, take: 1 },
          },
        },
      },
      orderBy: { openedAt: "desc" },
      skip: pagination.skip,
      take: pagination.take,
    }),
    prisma.workOrder.groupBy({
      by: ["type"],
      where: countWhere,
      _count: { _all: true },
    }),
  ]);

  const typeCounts = {
    [WORK_ORDER_TYPES.AFTER_SALES]: 0,
    [WORK_ORDER_TYPES.STOCK_REPAIR]: 0,
  };
  for (const row of grouped) {
    if (row.type in typeCounts) typeCounts[row.type] = row._count._all;
  }

  return { ...paginationResult(rows.map(serializeWorkOrder), total, pagination), typeCounts };
}

export async function getWorkOrder(id, session) {
  const order = await prisma.workOrder.findUnique({
    where: { id: Number(id) },
    include: workOrderInclude,
  });
  if (!order || !canViewWorkOrder(session, order)) throw notFound("Ordem de serviço não encontrada.");
  return serializeWorkOrder(order);
}

export async function createWorkOrder(payload, user) {
  const unitId = requireActiveUnit(user);
  const productId = parseId(payload.productId);
  const reportedDefect = String(payload.reportedDefect || "").trim();
  if (!reportedDefect) throw validationError("Descreva o defeito relatado.");

  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: { catalogModel: true, unit: { select: unitSelect } },
  });
  if (!product) throw notFound("Produto não encontrado.");
  assertProductCanOpenWorkOrder(product);

  const type = resolveWorkOrderType(product);
  let servicePlace = payload.servicePlace;
  if (type === WORK_ORDER_TYPES.STOCK_REPAIR) {
    servicePlace = SERVICE_PLACES.LAB;
  } else if (!Object.values(SERVICE_PLACES).includes(servicePlace)) {
    throw validationError("Informe se o reparo será no laboratório ou na casa do cliente.");
  }

  const open = await prisma.workOrder.findFirst({
    where: { productId: product.id, status: { notIn: WORK_ORDER_CLOSED_STATUSES } },
    select: { id: true, number: true },
  });
  if (open) throw conflict(`Já existe a ordem ${open.number} aberta para este produto.`);

  let sale = null;
  if (type === WORK_ORDER_TYPES.AFTER_SALES) {
    const saleRecord = await getLatestSale(product.id);
    sale = saleRecord;
    if (!sale) {
      if (!payload.customerId || !payload.warrantyMonths || !String(payload.invoiceNumber || "").trim()) {
        throw validationError("Informe o cliente, os meses de garantia e o número da NF para vincular esta venda.");
      }
      const { createSale } = await import("./sales");
      sale = await createSale({
        productId: product.id,
        customerId: payload.customerId,
        warrantyMonths: payload.warrantyMonths,
        invoiceNumber: payload.invoiceNumber,
        soldAt: payload.soldAt,
        user,
        product: { ...product, status: STATUSES.SOLD },
      });
    } else if (!sale.warrantyValid) {
      throw validationError("A garantia deste produto já venceu. Fora de garantia não é atendido neste módulo.");
    }
    if (!sale.warrantyValid) {
      throw validationError("A garantia deste produto já venceu. Fora de garantia não é atendido neste módulo.");
    }
  }

  const lab = servicePlace === SERVICE_PLACES.LAB ? await getLabUnit() : null;

  const created = await prisma.$transaction(async (tx) => {
    const order = await tx.workOrder.create({
      data: {
        number: `TMP-${Date.now()}-${user.id}`,
        productId: product.id,
        saleId: sale?.id ?? null,
        customerId: sale?.customerId ?? null,
        unitId,
        labUnitId: lab?.id ?? null,
        type,
        servicePlace,
        status: WORK_ORDER_STATUSES.OPEN,
        reportedDefect,
        createdById: user.id,
        technicianId: user.role === "TECNICO" ? user.id : null,
      },
    });

    const number = formatWorkOrderNumber(order.id);
    await tx.workOrder.update({ where: { id: order.id }, data: { number } });

    const productData = {
      status: STATUSES.IN_REPAIR,
      locationId: null,
      transferToUnitId: null,
    };
    if (lab) productData.unitId = lab.id;

    await tx.product.update({
      where: { id: product.id },
      data: productData,
    });

    const typeLabel = type === WORK_ORDER_TYPES.STOCK_REPAIR ? "reparo de estoque" : "pós-venda";
    await addEvent(tx, {
      workOrderId: order.id,
      type: "ABERTURA",
      message: lab
        ? `OS de ${typeLabel} aberta. Aparelho encaminhado ao laboratório ${lab.name}.`
        : `OS de ${typeLabel} aberta para reparo na casa do cliente.`,
      userId: user.id,
    });

    await writeMovement(
      {
        productId: product.id,
        type: lab ? MOVEMENT_TYPES.REPAIR_TO_LAB : MOVEMENT_TYPES.REPAIR_OPEN,
        previousStatus: product.status,
        newStatus: STATUSES.IN_REPAIR,
        observation: `${number} · ${typeLabel} · ${reportedDefect}`,
        previousLocationId: product.locationId,
        newLocationId: null,
        ...movementUnitFields(product, {
          previousUnitId: product.unitId,
          newUnitId: lab?.id ?? product.unitId,
        }),
        userId: user.id,
      },
      tx,
    );

    return tx.workOrder.findUnique({ where: { id: order.id }, include: workOrderInclude });
  });

  await writeAudit({
    userId: user.id,
    action: "WORK_ORDER_CREATED",
    entity: "work_order",
    entityId: created.id,
    newData: { number: created.number, productId: product.id, type, servicePlace },
  });

  return serializeWorkOrder(created);
}

function assertProductCanOpenWorkOrder(product) {
  if (product.status === STATUSES.IN_REPAIR) {
    throw validationError("Este produto já está em reparo.");
  }
  if ([STATUSES.IN_TRANSIT, STATUSES.TRANSFERRED, STATUSES.DISCARDED].includes(product.status)) {
    throw validationError("Não é possível abrir OS para produto em trânsito, transferido ou descartado.");
  }
  if (!WORK_ORDER_OPENABLE_STATUSES.includes(product.status)) {
    throw validationError("Este produto não pode receber uma ordem de serviço.");
  }
}

function restoreStatusForOrder(order) {
  return isStockRepair(order) ? STATUSES.AVAILABLE : STATUSES.SOLD;
}

function restoreUnitIdForOrder(order) {
  if (isStockRepair(order)) return order.unitId;
  return order.sale?.unitId || order.unitId;
}

export async function updateWorkOrder(id, payload, user) {
  const order = await getWorkOrder(id, user);
  assertOpen(order);

  const data = {};
  if (payload.analysisNotes !== undefined) data.analysisNotes = emptyToNull(payload.analysisNotes);
  if (payload.technicianNotes !== undefined) data.technicianNotes = emptyToNull(payload.technicianNotes);
  if (payload.technicianId !== undefined) {
    data.technicianId = payload.technicianId ? parseId(payload.technicianId) : null;
  }

  let nextStatus = order.status;
  if (payload.status !== undefined) {
    if (!Object.values(WORK_ORDER_STATUSES).includes(payload.status)) {
      throw validationError("Status da OS inválido.");
    }
    if (payload.status === WORK_ORDER_STATUSES.DELIVERED) {
      throw validationError(
        isStockRepair(order)
          ? "Use a ação de devolução para devolver o produto ao estoque."
          : "Use a ação de entrega para devolver o produto ao cliente.",
      );
    }
    nextStatus = payload.status;
    data.status = payload.status;
    if (WORK_ORDER_CLOSED_STATUSES.includes(payload.status)) {
      data.closedAt = new Date();
    }
  }

  const updated = await prisma.$transaction(async (tx) => {
    const saved = await tx.workOrder.update({
      where: { id: order.id },
      data,
      include: workOrderInclude,
    });

    if (data.analysisNotes && data.analysisNotes !== order.analysisNotes) {
      await addEvent(tx, {
        workOrderId: order.id,
        type: "ANALISE",
        message: data.analysisNotes,
        userId: user.id,
      });
    }
    if (data.technicianNotes && data.technicianNotes !== order.technicianNotes) {
      await addEvent(tx, {
        workOrderId: order.id,
        type: "APONTAMENTO",
        message: data.technicianNotes,
        userId: user.id,
      });
    }
    if (nextStatus !== order.status) {
      await addEvent(tx, {
        workOrderId: order.id,
        type: "STATUS",
        message: `${WORK_ORDER_STATUS_LABELS[order.status]} → ${WORK_ORDER_STATUS_LABELS[nextStatus]}`,
        userId: user.id,
      });
    }

    await restoreSoldIfClosed(tx, order, user, payload.status);

    return saved;
  });

  return serializeWorkOrder(updated);
}

export async function deliverWorkOrder(id, payload, user) {
  const order = await getWorkOrder(id, user);
  assertOpen(order);
  const stockRepair = isStockRepair(order);
  if (order.status !== WORK_ORDER_STATUSES.READY && order.status !== WORK_ORDER_STATUSES.REPAIRING) {
    throw validationError(
      stockRepair
        ? "Marque a OS como pronta antes de devolver o produto ao estoque."
        : "Marque a OS como pronta antes de devolver o produto ao cliente.",
    );
  }

  const originUnitId = restoreUnitIdForOrder(order);
  const nextProductStatus = restoreStatusForOrder(order);
  const observation = emptyToNull(payload?.observation);
  const nextTechnicianNotes =
    payload?.technicianNotes !== undefined ? emptyToNull(payload.technicianNotes) : undefined;
  const closeMessage = stockRepair
    ? "Produto reparado devolvido ao estoque."
    : "Produto reparado devolvido ao cliente.";

  const updated = await prisma.$transaction(async (tx) => {
    await tx.product.update({
      where: { id: order.productId },
      data: {
        status: nextProductStatus,
        unitId: originUnitId,
        locationId: null,
        transferToUnitId: null,
      },
    });

    const saved = await tx.workOrder.update({
      where: { id: order.id },
      data: {
        status: WORK_ORDER_STATUSES.DELIVERED,
        technicianNotes: nextTechnicianNotes,
        closedAt: new Date(),
        deliveredAt: new Date(),
      },
      include: workOrderInclude,
    });

    if (nextTechnicianNotes && nextTechnicianNotes !== order.technicianNotes) {
      await addEvent(tx, {
        workOrderId: order.id,
        type: "APONTAMENTO",
        message: nextTechnicianNotes,
        userId: user.id,
      });
    }

    await addEvent(tx, {
      workOrderId: order.id,
      type: "ENTREGA",
      message: observation || closeMessage,
      userId: user.id,
    });

    await writeMovement(
      {
        productId: order.productId,
        type: MOVEMENT_TYPES.REPAIR_DELIVER,
        previousStatus: STATUSES.IN_REPAIR,
        newStatus: nextProductStatus,
        observation: `${order.number} · ${stockRepair ? "devolvido ao estoque" : "devolvido ao cliente"}`,
        previousLocationId: order.product?.locationId ?? null,
        newLocationId: null,
        ...movementUnitFields(order.product, {
          previousUnitId: order.product?.unitId,
          newUnitId: originUnitId,
        }),
        userId: user.id,
      },
      tx,
    );

    return saved;
  });

  await writeAudit({
    userId: user.id,
    action: "WORK_ORDER_DELIVERED",
    entity: "work_order",
    entityId: order.id,
    newData: { number: order.number },
  });

  return serializeWorkOrder(updated);
}

export async function setWorkOrderLocation(id, payload, user) {
  const order = await getWorkOrder(id, user);
  assertOpen(order);
  if (order.servicePlace !== SERVICE_PLACES.LAB) {
    throw validationError("Localização no lab só se aplica a reparo no laboratório.");
  }
  const unitId = requireActiveUnit(user);
  if (order.labUnitId && unitId !== order.labUnitId) {
    throw forbidden("Troque para a unidade do laboratório para posicionar o aparelho.");
  }

  const locationId = parseId(payload.locationId);
  const location = await prisma.location.findFirst({
    where: { id: locationId, unitId, active: true },
    include: locationInclude,
  });
  if (!location) throw validationError("Localização inválida para esta unidade.");

  await prisma.$transaction(async (tx) => {
    await tx.product.update({
      where: { id: order.productId },
      data: { locationId: location.id, unitId },
    });
    await addEvent(tx, {
      workOrderId: order.id,
      type: "LOCALIZACAO",
      message: `Aparelho posicionado em ${formatLocationPath(location)}.`,
      userId: user.id,
    });
    await writeMovement(
      {
        productId: order.productId,
        type: MOVEMENT_TYPES.LOCATION_CHANGE,
        previousStatus: STATUSES.IN_REPAIR,
        newStatus: STATUSES.IN_REPAIR,
        observation: formatLocationPath(location),
        previousLocationId: order.product?.locationId ?? null,
        newLocationId: location.id,
        ...movementUnitFields(order.product, { previousUnitId: order.product?.unitId, newUnitId: unitId }),
        userId: user.id,
      },
      tx,
    );
  });

  return getWorkOrder(id, user);
}

export async function requestWorkOrderPart(id, payload, user) {
  const order = await getWorkOrder(id, user);
  assertOpen(order);
  const partId = parseId(payload.partId);
  const quantity = Math.trunc(toNumber(payload.quantity, 0));
  if (quantity < 1) throw validationError("Informe a quantidade da peça.");

  const part = await prisma.part.findUnique({ where: { id: partId } });
  if (!part || !part.active) throw validationError("Peça inválida ou inativa.");

  await prisma.$transaction(async (tx) => {
    await tx.workOrderPart.create({
      data: {
        workOrderId: order.id,
        partId: part.id,
        quantity,
        status: WORK_ORDER_PART_STATUSES.REQUESTED,
        observation: emptyToNull(payload.observation),
        requestedById: user.id,
      },
    });
    const data = {};
    if ([WORK_ORDER_STATUSES.OPEN, WORK_ORDER_STATUSES.ANALYSIS, WORK_ORDER_STATUSES.REPAIRING].includes(order.status)) {
      data.status = WORK_ORDER_STATUSES.WAITING_PART;
    }
    if (Object.keys(data).length) {
      await tx.workOrder.update({ where: { id: order.id }, data });
    }
    await addEvent(tx, {
      workOrderId: order.id,
      type: "PECA_SOLICITADA",
      message: `Solicitada peça ${part.code} · ${part.name} (qtd ${quantity}).`,
      userId: user.id,
    });
  });

  return getWorkOrder(id, user);
}

async function restoreSoldIfClosed(tx, order, user, nextStatus) {
  if (nextStatus !== WORK_ORDER_STATUSES.UNREPAIRABLE && nextStatus !== WORK_ORDER_STATUSES.CANCELLED) return;
  const nextProductStatus = restoreStatusForOrder(order);
  const originUnitId = restoreUnitIdForOrder(order);
  await tx.product.update({
    where: { id: order.productId },
    data: {
      status: nextProductStatus,
      unitId: originUnitId,
      locationId: null,
    },
  });
  await writeMovement(
    {
      productId: order.productId,
      type: MOVEMENT_TYPES.REPAIR_DELIVER,
      previousStatus: STATUSES.IN_REPAIR,
      newStatus: nextProductStatus,
      observation: `${order.number} encerrada (${WORK_ORDER_STATUS_LABELS[nextStatus]}).`,
      ...movementUnitFields(order.product, {
        previousUnitId: order.product?.unitId,
        newUnitId: originUnitId,
      }),
      userId: user.id,
    },
    tx,
  );
}

export async function addWorkOrderInteraction(id, payload, user) {
  const order = await getWorkOrder(id, user);
  assertOpen(order);

  const files = payload.files || [];
  const eventId = payload.eventId ? parseId(payload.eventId) : null;
  if (eventId) {
    const exists = (order.events || []).some((event) => event.id === eventId);
    if (!exists) throw notFound("Interação não encontrada.");
    if (!files.length) throw validationError("Selecione ao menos uma imagem.");
    const { addWorkOrderImageFiles } = await import("./images");
    await addWorkOrderImageFiles(order.id, files, user);
    return getWorkOrder(id, user);
  }

  const allowedTypes = Object.values(WORK_ORDER_EVENT_TYPES);
  const type = payload.type || (files.length && !String(payload.message || "").trim()
    ? WORK_ORDER_EVENT_TYPES.EVIDENCE
    : WORK_ORDER_EVENT_TYPES.NOTE);
  if (!allowedTypes.includes(type)) throw validationError("Tipo de interação inválido.");

  const message = String(payload.message || "").trim();
  const nextStatus = payload.status && payload.status !== order.status ? payload.status : null;
  if (nextStatus) {
    if (!Object.values(WORK_ORDER_STATUSES).includes(nextStatus)) {
      throw validationError("Status da OS inválido.");
    }
    if (nextStatus === WORK_ORDER_STATUSES.DELIVERED) {
      throw validationError(
        isStockRepair(order)
          ? "Use a ação de devolução para devolver o produto ao estoque."
          : "Use a ação de entrega para devolver o produto ao cliente.",
      );
    }
  }
  if (!message && !files.length && !nextStatus) {
    throw validationError("Descreva a interação, altere o status ou anexe evidências.");
  }

  const lines = [];
  if (nextStatus) lines.push(`${WORK_ORDER_STATUS_LABELS[order.status]} → ${WORK_ORDER_STATUS_LABELS[nextStatus]}`);
  if (message) lines.push(message);
  if (!lines.length && files.length) lines.push(`${files.length} evidência(s) anexada(s).`);

  const eventType = message || files.length ? type : WORK_ORDER_EVENT_TYPES.STATUS;
  await prisma.$transaction(async (tx) => {
    const data = {};
    if (type === WORK_ORDER_EVENT_TYPES.ANALYSIS && message) data.analysisNotes = message;
    if (type === WORK_ORDER_EVENT_TYPES.TECHNICIAN_NOTE && message) data.technicianNotes = message;
    if (nextStatus) {
      data.status = nextStatus;
      if (WORK_ORDER_CLOSED_STATUSES.includes(nextStatus)) data.closedAt = new Date();
    }
    if (Object.keys(data).length) {
      await tx.workOrder.update({ where: { id: order.id }, data });
    }
    await restoreSoldIfClosed(tx, order, user, nextStatus);
    await addEvent(tx, {
      workOrderId: order.id,
      type: eventType,
      message: lines.join("\n\n"),
      userId: user.id,
    });
  });

  if (files.length) {
    const { addWorkOrderImageFiles } = await import("./images");
    await addWorkOrderImageFiles(order.id, files, user);
  }

  return getWorkOrder(id, user);
}

export async function addWorkOrderImages(id, files, user, { eventId, message } = {}) {
  const order = await getWorkOrder(id, user);
  assertOpen(order);
  if (!files?.length) throw validationError("Selecione ao menos uma imagem.");

  if (eventId) {
    const exists = (order.events || []).some((event) => event.id === parseId(eventId));
    if (!exists) throw notFound("Interação não encontrada.");
  } else {
    await prisma.workOrderEvent.create({
      data: {
        workOrderId: order.id,
        type: WORK_ORDER_EVENT_TYPES.EVIDENCE,
        message: String(message || "").trim() || `${files.length} evidência(s) anexada(s).`,
        userId: user.id,
      },
    });
  }

  const { addWorkOrderImageFiles } = await import("./images");
  await addWorkOrderImageFiles(order.id, files, user);
  return getWorkOrder(id, user);
}

export async function lookupSoldProduct(query, session, { productId } = {}) {
  const lookupInclude = {
    catalogModel: true,
    category: true,
    images: { where: { isPrimary: true }, take: 1 },
    sales: { orderBy: { soldAt: "desc" }, take: 1, include: { customer: true } },
  };

  function serializeLookup(item) {
    return {
      ...item,
      commercialName: item.catalogModel?.commercialName || null,
      primaryImage: item.images?.[0] || null,
      latestSale: item.sales?.[0] ? serializeSale(item.sales[0]) : null,
      workOrderType: resolveWorkOrderType(item),
    };
  }

  if (productId) {
    const id = Number(String(productId).replace(/^#/, ""));
    if (!Number.isInteger(id) || id < 1) return [];
    const item = await prisma.product.findUnique({
      where: { id },
      include: lookupInclude,
    });
    if (!item || !canViewProduct(session, item)) return [];
    const open = await prisma.workOrder.findFirst({
      where: { productId: item.id, status: { notIn: WORK_ORDER_CLOSED_STATUSES } },
      select: { id: true },
    });
    if (open) return [];
    return [serializeLookup(item)];
  }

  const text = String(query || "").trim();
  if (!text) return [];
  const unitId = requireActiveUnit(session);
  const numeric = Number(text.replace(/^#/, ""));
  const or = [
    { serialOnyx: { contains: text } },
    { ean: { contains: text } },
    { supplierModelCode: { contains: text } },
    { catalogModel: { commercialName: { contains: text } } },
  ];
  if (Number.isInteger(numeric) && numeric > 0) {
    or.push({ id: numeric });
  }
  const items = await prisma.product.findMany({
    where: {
      unitId,
      status: { in: WORK_ORDER_OPENABLE_STATUSES },
      OR: or,
    },
    include: lookupInclude,
    take: 12,
    orderBy: { updatedAt: "desc" },
  });

  return items.map(serializeLookup);
}
