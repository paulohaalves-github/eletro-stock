import { prisma } from "../db";
import { conflict, notFound, validationError } from "../errors";
import { writeAudit } from "../audit";
import { formatLocationPath } from "../format";

export { formatLocationPath };

const locationTypeSelect = {
  id: true,
  name: true,
  active: true,
  createdAt: true,
  updatedAt: true,
};

const locationInclude = {
  locationType: { select: locationTypeSelect },
};

export async function listLocationTypes({ active, includeCounts = false } = {}) {
  const where = {};
  if (active === true || active === "true") where.active = true;
  if (active === false || active === "false") where.active = false;

  const items = await prisma.locationType.findMany({
    where,
    orderBy: { name: "asc" },
    ...(includeCounts
      ? {
          include: {
            _count: { select: { locations: true } },
            locations: { select: { id: true } },
          },
        }
      : {}),
  });

  if (!includeCounts) return items;

  const typeIds = items.map((item) => item.id);
  const productCounts = typeIds.length
    ? await prisma.product.groupBy({
        by: ["locationId"],
        where: { location: { locationTypeId: { in: typeIds } } },
        _count: { _all: true },
      })
    : [];

  const locationToCount = Object.fromEntries(productCounts.map((row) => [row.locationId, row._count._all]));

  return items.map((item) => {
    const productCount = item.locations.reduce((sum, location) => sum + (locationToCount[location.id] || 0), 0);
    return {
      id: item.id,
      name: item.name,
      active: item.active,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      locationCount: item._count.locations,
      productCount,
    };
  });
}

export async function createLocationType(payload, actor) {
  const name = String(payload.name || "").trim();
  if (!name) throw validationError("Informe o nome do tipo de localização.");

  const exists = await prisma.locationType.findFirst({ where: { name } });
  if (exists) throw conflict("Já existe um tipo de localização com este nome.");

  const item = await prisma.locationType.create({
    data: { name, active: payload.active !== false },
  });

  await writeAudit({
    userId: actor.id,
    action: "LOCATION_TYPE_CREATED",
    entity: "location_type",
    entityId: item.id,
    newData: item,
  });

  return item;
}

export async function updateLocationType(id, payload, actor) {
  const current = await prisma.locationType.findUnique({ where: { id: Number(id) } });
  if (!current) throw notFound("Tipo de localização não encontrado.");

  const data = {};
  if (payload.name !== undefined) {
    const name = String(payload.name || "").trim();
    if (!name) throw validationError("Informe o nome do tipo de localização.");
    const exists = await prisma.locationType.findFirst({
      where: { name, id: { not: current.id } },
    });
    if (exists) throw conflict("Já existe um tipo de localização com este nome.");
    data.name = name;
  }
  if (payload.active !== undefined) data.active = Boolean(payload.active);

  const item = await prisma.locationType.update({
    where: { id: current.id },
    data,
  });

  await writeAudit({
    userId: actor.id,
    action: "LOCATION_TYPE_UPDATED",
    entity: "location_type",
    entityId: item.id,
    oldData: current,
    newData: item,
  });

  return item;
}

export async function deleteLocationType(id, actor) {
  const current = await prisma.locationType.findUnique({
    where: { id: Number(id) },
    include: { _count: { select: { locations: true } } },
  });
  if (!current) throw notFound("Tipo de localização não encontrado.");
  if (current._count.locations > 0) {
    throw conflict("Não é possível excluir um tipo que possui localizações. Inative-o ou remova as localizações vazias primeiro.");
  }

  await prisma.locationType.delete({ where: { id: current.id } });
  await writeAudit({
    userId: actor.id,
    action: "LOCATION_TYPE_DELETED",
    entity: "location_type",
    entityId: current.id,
    oldData: current,
  });
}

export async function listLocations({ locationTypeId, active, includeCounts = false } = {}) {
  const where = {};
  if (locationTypeId) where.locationTypeId = Number(locationTypeId);
  if (active === true || active === "true") where.active = true;
  if (active === false || active === "false") where.active = false;

  const items = await prisma.location.findMany({
    where,
    include: {
      ...locationInclude,
      ...(includeCounts ? { _count: { select: { products: true } } } : {}),
    },
    orderBy: [{ locationTypeId: "asc" }, { name: "asc" }],
  });

  return includeCounts
    ? items.map((item) => ({ ...item, productCount: item._count.products }))
    : items;
}

export async function createLocation(payload, actor) {
  const name = String(payload.name || "").trim();
  const locationTypeId = Number(payload.locationTypeId);
  if (!name) throw validationError("Informe o nome ou código da localização.");
  if (!Number.isInteger(locationTypeId) || locationTypeId <= 0) {
    throw validationError("Informe o tipo de localização.");
  }

  const type = await prisma.locationType.findUnique({ where: { id: locationTypeId } });
  if (!type) throw notFound("Tipo de localização não encontrado.");

  const exists = await prisma.location.findFirst({
    where: { locationTypeId, name },
  });
  if (exists) throw conflict("Já existe uma localização com este nome neste tipo.");

  const item = await prisma.location.create({
    data: {
      name,
      locationTypeId,
      active: payload.active !== false,
    },
    include: locationInclude,
  });

  await writeAudit({
    userId: actor.id,
    action: "LOCATION_CREATED",
    entity: "location",
    entityId: item.id,
    newData: item,
  });

  return item;
}

export async function updateLocation(id, payload, actor) {
  const current = await prisma.location.findUnique({
    where: { id: Number(id) },
    include: locationInclude,
  });
  if (!current) throw notFound("Localização não encontrada.");

  const data = {};
  if (payload.locationTypeId !== undefined) {
    const locationTypeId = Number(payload.locationTypeId);
    if (!Number.isInteger(locationTypeId) || locationTypeId <= 0) {
      throw validationError("Informe o tipo de localização.");
    }
    const type = await prisma.locationType.findUnique({ where: { id: locationTypeId } });
    if (!type) throw notFound("Tipo de localização não encontrado.");
    data.locationTypeId = locationTypeId;
  }
  if (payload.name !== undefined) {
    const name = String(payload.name || "").trim();
    if (!name) throw validationError("Informe o nome ou código da localização.");
    data.name = name;
  }
  if (payload.active !== undefined) data.active = Boolean(payload.active);

  const nextTypeId = data.locationTypeId ?? current.locationTypeId;
  const nextName = data.name ?? current.name;
  const exists = await prisma.location.findFirst({
    where: {
      locationTypeId: nextTypeId,
      name: nextName,
      id: { not: current.id },
    },
  });
  if (exists) throw conflict("Já existe uma localização com este nome neste tipo.");

  const item = await prisma.location.update({
    where: { id: current.id },
    data,
    include: locationInclude,
  });

  await writeAudit({
    userId: actor.id,
    action: "LOCATION_UPDATED",
    entity: "location",
    entityId: item.id,
    oldData: current,
    newData: item,
  });

  return item;
}

export async function deleteLocation(id, actor) {
  const current = await prisma.location.findUnique({
    where: { id: Number(id) },
    include: {
      locationType: true,
      _count: { select: { products: true, movementsFrom: true, movementsTo: true } },
    },
  });
  if (!current) throw notFound("Localização não encontrada.");
  if (current._count.products > 0) {
    throw conflict("Não é possível excluir uma localização com produtos vinculados. Inative-a.");
  }
  if (current._count.movementsFrom > 0 || current._count.movementsTo > 0) {
    throw conflict("Não é possível excluir uma localização que já aparece no histórico de movimentações. Inative-a.");
  }

  await prisma.location.delete({ where: { id: current.id } });
  await writeAudit({
    userId: actor.id,
    action: "LOCATION_DELETED",
    entity: "location",
    entityId: current.id,
    oldData: current,
  });
}

export async function resolveProductLocation(payload, { currentLocationId = null } = {}) {
  const sentId = payload.locationId;
  const sentTypeId = payload.locationTypeId;

  if (sentId === undefined && sentTypeId === undefined) return undefined;

  if (sentId === "" || sentId === null) {
    if (sentTypeId && String(sentTypeId).trim()) {
      throw validationError("Selecione a localização do tipo informado.");
    }
    return null;
  }

  const locationId = Number(sentId);
  if (!Number.isInteger(locationId) || locationId <= 0) {
    throw validationError("Localização inválida.");
  }

  const location = await prisma.location.findUnique({
    where: { id: locationId },
    include: locationInclude,
  });
  if (!location) throw validationError("Localização inválida.");

  if (sentTypeId !== undefined && sentTypeId !== "" && sentTypeId !== null) {
    const typeId = Number(sentTypeId);
    if (!Number.isInteger(typeId) || typeId <= 0 || typeId !== location.locationTypeId) {
      throw validationError("A localização selecionada não pertence ao tipo informado.");
    }
  }

  const keepingCurrent = currentLocationId != null && location.id === Number(currentLocationId);
  if (!keepingCurrent) {
    if (!location.active) throw validationError("Esta localização está inativa.");
    if (!location.locationType?.active) throw validationError("Este tipo de localização está inativo.");
  }

  return location;
}
