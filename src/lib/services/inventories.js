import { prisma } from "../db";
import { writeAudit } from "../audit";
import {
  INVENTORY_SCAN_KINDS,
  INVENTORY_STATUSES,
  STATUS_LABELS,
  inventoryExpectedStatuses,
} from "../constants";
import { conflict, forbidden, notFound, validationError } from "../errors";
import { formatLocationPath } from "../format";
import { CODE_TYPES, normalizeCode, parseQrPayload } from "../scanner";
import { can, PERMISSIONS } from "../permissions";
import { assertUnitAccess, getUnitOrThrow, hasUnitAccess, requireActiveUnit, unitSelect } from "../units";
import { emptyToNull, parseId } from "../validations";

const userBrief = { id: true, name: true };
const locationInclude = { locationType: { select: { id: true, name: true } } };

const headerInclude = {
  unit: { select: unitSelect },
  location: { include: locationInclude },
  createdBy: { select: userBrief },
  assignedTo: { select: userBrief },
  completedBy: { select: userBrief },
  cancelledBy: { select: userBrief },
};

const productLookupInclude = {
  catalogModel: { select: { commercialName: true } },
  unit: { select: unitSelect },
  location: { include: locationInclude },
};

function scopeLabel(inventory) {
  return inventory.locationLabel || "Unidade inteira";
}

function countsFrom(expectedCount, scans) {
  const matched = scans.filter((scan) => scan.kind === INVENTORY_SCAN_KINDS.MATCHED).length;
  const surplus = scans.filter((scan) => scan.kind !== INVENTORY_SCAN_KINDS.MATCHED).length;
  return {
    expected: expectedCount,
    scanned: scans.length,
    matched,
    surplus,
    missing: Math.max(0, expectedCount - matched),
  };
}

function serializeScan(scan) {
  return {
    id: scan.id,
    productId: scan.productId,
    rawCode: scan.rawCode,
    kind: scan.kind,
    serialOnyx: scan.serialOnyx,
    commercialName: scan.commercialName,
    productStatus: scan.productStatus,
    unitName: scan.unitName,
    note: scan.note,
    scannedAt: scan.scannedAt,
    scannedBy: scan.scannedBy || null,
  };
}

function serializeSummary(inventory, counts) {
  return {
    id: inventory.id,
    number: inventory.number,
    status: inventory.status,
    notes: inventory.notes,
    scopeLabel: scopeLabel(inventory),
    locationId: inventory.locationId,
    expectedCount: inventory.expectedCount,
    counts,
    unit: inventory.unit,
    createdBy: inventory.createdBy,
    assignedTo: inventory.assignedTo,
    completedBy: inventory.completedBy,
    completedAt: inventory.completedAt,
    cancelledBy: inventory.cancelledBy,
    cancelledAt: inventory.cancelledAt,
    createdAt: inventory.createdAt,
  };
}

function canManage(session) {
  return can(session.role, PERMISSIONS.INVENTORY_MANAGE);
}

function assertCanRead(session, inventory) {
  if (canManage(session) && hasUnitAccess(session, inventory.unitId)) return;
  if (inventory.assignedToId === session.id) return;
  throw notFound("Inventário não encontrado.");
}

function accessFlags(session, inventory) {
  const open = inventory.status === INVENTORY_STATUSES.OPEN;
  const assignee = inventory.assignedToId === session.id;
  return {
    canScan: open && assignee,
    canConclude: open && assignee,
    canCancel: open && canManage(session) && hasUnitAccess(session, inventory.unitId),
  };
}

async function loadInventory(id) {
  const inventory = await prisma.inventoryCount.findUnique({
    where: { id },
    include: headerInclude,
  });
  if (!inventory) throw notFound("Inventário não encontrado.");
  return inventory;
}

function commercialNameOf(product) {
  return product.catalogModel?.commercialName || product.supplierModelCode || null;
}

function surplusNote(product, inventory) {
  if (product.deletedAt) return "Este produto está na lixeira.";
  if (product.unitId !== inventory.unitId) {
    return `Cadastrado na unidade ${product.unit?.name || "outra"}.`;
  }
  if (inventory.locationId && product.locationId !== inventory.locationId) {
    const where = formatLocationPath(product.location) || "sem localização";
    return `Está em ${where}, fora da localização deste inventário.`;
  }
  const label = STATUS_LABELS[product.status] || product.status;
  return `No sistema está ${label}, fora do estoque esperado.`;
}

async function findProductByCode(raw) {
  const parsed = parseQrPayload(raw);
  const code = normalizeCode(parsed.query || raw);
  if (!code) throw validationError("Informe o código lido.");
  if (code.length > 190) throw validationError("Código longo demais.");

  const idCandidate = parsed.productId || (parsed.type === CODE_TYPES.INTERNAL ? parsed.query : null);
  if (idCandidate && /^\d+$/.test(String(idCandidate))) {
    const byId = await prisma.product.findUnique({
      where: { id: Number(idCandidate) },
      include: productLookupInclude,
    });
    if (byId) return { product: byId, code };
  }

  const bySerial = await prisma.product.findFirst({
    where: { serialOnyx: code },
    include: productLookupInclude,
  });
  if (bySerial) return { product: bySerial, code };

  if (parsed.type === CODE_TYPES.EAN) {
    const eanHit = await prisma.product.findFirst({
      where: { ean: code, deletedAt: null },
      select: { id: true },
    });
    if (eanHit) {
      throw validationError("O EAN não identifica a peça. Bipe o serial Onyx ou o código da etiqueta da unidade.");
    }
  }

  return { product: null, code };
}

export async function listInventories(session) {
  const where = canManage(session)
    ? { OR: [{ unitId: requireActiveUnit(session) }, { assignedToId: session.id }] }
    : { assignedToId: session.id };

  const items = await prisma.inventoryCount.findMany({
    where,
    include: headerInclude,
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  const countsById = await loadCountsByInventory(items);

  return {
    canManage: canManage(session),
    items: items.map((item) => serializeSummary(item, countsById.get(item.id))),
  };
}

async function loadCountsByInventory(items) {
  const ids = items.map((item) => item.id);
  const groups = ids.length
    ? await prisma.inventoryScan.groupBy({
      by: ["inventoryId", "kind"],
      where: { inventoryId: { in: ids } },
      _count: { _all: true },
    })
    : [];
  const map = new Map();
  for (const item of items) {
    const rows = groups.filter((row) => row.inventoryId === item.id);
    const matched = rows.find((row) => row.kind === INVENTORY_SCAN_KINDS.MATCHED)?._count._all || 0;
    const scanned = rows.reduce((sum, row) => sum + row._count._all, 0);
    map.set(item.id, {
      expected: item.expectedCount,
      scanned,
      matched,
      surplus: scanned - matched,
      missing: Math.max(0, item.expectedCount - matched),
    });
  }
  return map;
}

export async function listInventoryAssignees(session) {
  if (!canManage(session)) throw forbidden();
  const items = await prisma.user.findMany({
    where: { active: true },
    select: { id: true, name: true, role: true },
    orderBy: { name: "asc" },
  });
  return { items };
}

export async function createInventory(payload, session) {
  if (!canManage(session)) throw forbidden();
  const unitId = requireActiveUnit(session);
  assertUnitAccess(session, unitId);
  const unit = await getUnitOrThrow(unitId);

  const assignedToId = parseId(payload.assignedToId);
  const assignee = await prisma.user.findUnique({
    where: { id: assignedToId },
    select: { id: true, active: true },
  });
  if (!assignee || !assignee.active) throw validationError("Usuário designado inválido.");

  let location = null;
  if (payload.locationId) {
    location = await prisma.location.findFirst({
      where: { id: parseId(payload.locationId), unitId, active: true },
      include: locationInclude,
    });
    if (!location) throw validationError("Localização inválida para esta unidade.");
  }

  const notes = emptyToNull(payload.notes);
  if (notes && notes.length > 1000) throw validationError("A observação deve ter no máximo 1000 caracteres.");

  const expectedProducts = await prisma.product.findMany({
    where: {
      unitId,
      deletedAt: null,
      status: { in: inventoryExpectedStatuses(unit.type) },
      ...(location ? { locationId: location.id } : {}),
    },
    select: {
      id: true,
      serialOnyx: true,
      status: true,
      supplierModelCode: true,
      catalogModel: { select: { commercialName: true } },
      location: { include: locationInclude },
    },
  });

  const inventoryId = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM units WHERE id = ${unitId} FOR UPDATE`;
    const open = await tx.inventoryCount.findFirst({
      where: { unitId, status: INVENTORY_STATUSES.OPEN },
      select: { number: true },
    });
    if (open) {
      throw conflict(`Já existe o inventário ${open.number} aberto nesta unidade. Conclua ou cancele antes de abrir outro.`);
    }

    const created = await tx.inventoryCount.create({
      data: {
        number: `TMP-${Date.now()}-${session.id}`,
        unitId,
        locationId: location?.id ?? null,
        locationLabel: location ? formatLocationPath(location) : null,
        status: INVENTORY_STATUSES.OPEN,
        notes,
        expectedCount: expectedProducts.length,
        createdById: session.id,
        assignedToId: assignee.id,
      },
    });
    const number = `INV-${String(created.id).padStart(5, "0")}`;
    await tx.inventoryCount.update({ where: { id: created.id }, data: { number } });

    if (expectedProducts.length) {
      await tx.inventoryExpectedItem.createMany({
        data: expectedProducts.map((product) => ({
          inventoryId: created.id,
          productId: product.id,
          serialOnyx: product.serialOnyx,
          commercialName: commercialNameOf(product),
          status: product.status,
          locationLabel: formatLocationPath(product.location),
        })),
      });
    }

    return created.id;
  });

  await writeAudit({
    userId: session.id,
    action: "INVENTORY_CREATED",
    entity: "inventory",
    entityId: inventoryId,
    newData: {
      unitId,
      locationId: location?.id ?? null,
      assignedToId: assignee.id,
      expectedCount: expectedProducts.length,
    },
  });

  return getInventory(inventoryId, session);
}

export async function getInventory(id, session) {
  const inventory = await loadInventory(parseId(id));
  assertCanRead(session, inventory);

  const [scans, countRows] = await Promise.all([
    prisma.inventoryScan.findMany({
      where: { inventoryId: inventory.id },
      orderBy: { scannedAt: "desc" },
      include: { scannedBy: { select: userBrief } },
      take: 200,
    }),
    prisma.inventoryScan.groupBy({
      by: ["kind"],
      where: { inventoryId: inventory.id },
      _count: { _all: true },
    }),
  ]);
  const matched = countRows.find((row) => row.kind === INVENTORY_SCAN_KINDS.MATCHED)?._count._all || 0;
  const scanned = countRows.reduce((sum, row) => sum + row._count._all, 0);
  const counts = {
    expected: inventory.expectedCount,
    scanned,
    matched,
    surplus: scanned - matched,
    missing: Math.max(0, inventory.expectedCount - matched),
  };

  let missing = [];
  let surplus = [];
  if (inventory.status === INVENTORY_STATUSES.COMPLETED) {
    const matchedRows = await prisma.inventoryScan.findMany({
      where: { inventoryId: inventory.id, kind: INVENTORY_SCAN_KINDS.MATCHED, productId: { not: null } },
      select: { productId: true },
    });
    const matchedIds = matchedRows.map((scan) => scan.productId);
    missing = await prisma.inventoryExpectedItem.findMany({
      where: {
        inventoryId: inventory.id,
        ...(matchedIds.length ? { productId: { notIn: matchedIds } } : {}),
      },
      orderBy: { serialOnyx: "asc" },
    });
    surplus = await prisma.inventoryScan.findMany({
      where: { inventoryId: inventory.id, kind: { not: INVENTORY_SCAN_KINDS.MATCHED } },
      orderBy: { scannedAt: "asc" },
      include: { scannedBy: { select: userBrief } },
    });
  }

  return {
    ...serializeSummary(inventory, counts),
    access: accessFlags(session, inventory),
    scans: scans.map(serializeScan),
    missing: missing.map((item) => ({
      productId: item.productId,
      serialOnyx: item.serialOnyx,
      commercialName: item.commercialName,
      status: item.status,
      locationLabel: item.locationLabel,
    })),
    surplus: surplus.map(serializeScan),
  };
}

export async function scanInventory(id, payload, session) {
  const inventoryId = parseId(id);
  const { product, code } = await findProductByCode(payload.code ?? payload.raw ?? "");

  const scan = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM inventory_counts WHERE id = ${inventoryId} FOR UPDATE`;
    const inventory = await tx.inventoryCount.findUnique({ where: { id: inventoryId } });
    if (!inventory) throw notFound("Inventário não encontrado.");
    if (inventory.assignedToId !== session.id) throw forbidden("Só o usuário designado pode bipar este inventário.");
    if (inventory.status !== INVENTORY_STATUSES.OPEN) throw conflict("Este inventário já foi encerrado.");

    const duplicate = await tx.inventoryScan.findFirst({
      where: {
        inventoryId,
        OR: [
          { rawCode: code },
          ...(product ? [{ productId: product.id }] : []),
        ],
      },
      select: { id: true },
    });
    if (duplicate) throw conflict("Este código já foi bipado neste inventário.");

    let kind = INVENTORY_SCAN_KINDS.UNKNOWN;
    let note = "Código não cadastrado no sistema.";
    if (product) {
      const expected = await tx.inventoryExpectedItem.findUnique({
        where: { inventoryId_productId: { inventoryId, productId: product.id } },
        select: { id: true },
      });
      if (expected) {
        kind = INVENTORY_SCAN_KINDS.MATCHED;
        note = null;
      } else {
        kind = INVENTORY_SCAN_KINDS.SURPLUS;
        note = surplusNote(product, inventory);
      }
    }

    try {
      return await tx.inventoryScan.create({
        data: {
          inventoryId,
          productId: product?.id ?? null,
          rawCode: code,
          kind,
          serialOnyx: product?.serialOnyx ?? null,
          commercialName: product ? commercialNameOf(product) : null,
          productStatus: product?.status ?? null,
          unitName: product?.unit?.name ?? null,
          note,
          scannedById: session.id,
        },
        include: { scannedBy: { select: userBrief } },
      });
    } catch (error) {
      if (error?.code === "P2002") throw conflict("Este código já foi bipado neste inventário.");
      throw error;
    }
  });

  const scans = await prisma.inventoryScan.findMany({
    where: { inventoryId },
    select: { kind: true },
  });
  const inventory = await prisma.inventoryCount.findUnique({
    where: { id: inventoryId },
    select: { expectedCount: true },
  });

  const label = scan.serialOnyx || scan.rawCode;
  const message = scan.kind === INVENTORY_SCAN_KINDS.MATCHED
    ? `Conferido: ${label}`
    : scan.kind === INVENTORY_SCAN_KINDS.SURPLUS
      ? `Sobrante: ${label}`
      : `Não cadastrado: ${label}`;

  return {
    scan: serializeScan(scan),
    counts: countsFrom(inventory.expectedCount, scans),
    message,
  };
}

export async function removeInventoryScan(id, scanId, session) {
  const inventoryId = parseId(id);
  const targetId = parseId(scanId);

  await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM inventory_counts WHERE id = ${inventoryId} FOR UPDATE`;
    const inventory = await tx.inventoryCount.findUnique({ where: { id: inventoryId } });
    if (!inventory) throw notFound("Inventário não encontrado.");
    if (inventory.assignedToId !== session.id) throw forbidden("Só o usuário designado pode desfazer uma bipagem.");
    if (inventory.status !== INVENTORY_STATUSES.OPEN) throw conflict("Este inventário já foi encerrado.");
    const scan = await tx.inventoryScan.findFirst({ where: { id: targetId, inventoryId } });
    if (!scan) throw notFound("Bipagem não encontrada.");
    await tx.inventoryScan.delete({ where: { id: scan.id } });
  });

  const [scans, inventory] = await Promise.all([
    prisma.inventoryScan.findMany({ where: { inventoryId }, select: { kind: true } }),
    prisma.inventoryCount.findUnique({ where: { id: inventoryId }, select: { expectedCount: true } }),
  ]);

  return {
    counts: countsFrom(inventory.expectedCount, scans),
    message: "Bipagem removida.",
  };
}

export async function concludeInventory(id, session) {
  const inventoryId = parseId(id);

  await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM inventory_counts WHERE id = ${inventoryId} FOR UPDATE`;
    const inventory = await tx.inventoryCount.findUnique({ where: { id: inventoryId } });
    if (!inventory) throw notFound("Inventário não encontrado.");
    if (inventory.assignedToId !== session.id) throw forbidden("Só o usuário designado pode concluir este inventário.");
    if (inventory.status !== INVENTORY_STATUSES.OPEN) throw conflict("Este inventário já foi encerrado.");
    await tx.inventoryCount.update({
      where: { id: inventoryId },
      data: {
        status: INVENTORY_STATUSES.COMPLETED,
        completedAt: new Date(),
        completedById: session.id,
      },
    });
  });

  await writeAudit({
    userId: session.id,
    action: "INVENTORY_COMPLETED",
    entity: "inventory",
    entityId: inventoryId,
    newData: { status: INVENTORY_STATUSES.COMPLETED },
  });

  return getInventory(inventoryId, session);
}

export async function cancelInventory(id, session) {
  if (!canManage(session)) throw forbidden();
  const inventoryId = parseId(id);
  const current = await loadInventory(inventoryId);
  assertUnitAccess(session, current.unitId);
  if (current.status !== INVENTORY_STATUSES.OPEN) throw conflict("Só um inventário aberto pode ser cancelado.");

  await prisma.inventoryCount.update({
    where: { id: inventoryId },
    data: {
      status: INVENTORY_STATUSES.CANCELLED,
      cancelledAt: new Date(),
      cancelledById: session.id,
    },
  });

  await writeAudit({
    userId: session.id,
    action: "INVENTORY_CANCELLED",
    entity: "inventory",
    entityId: inventoryId,
    oldData: { status: current.status },
    newData: { status: INVENTORY_STATUSES.CANCELLED },
  });

  return getInventory(inventoryId, session);
}
