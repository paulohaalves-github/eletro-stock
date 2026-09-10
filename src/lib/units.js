import { prisma } from "./db";
import { conflict, forbidden, notFound, validationError } from "./errors";
import { writeAudit } from "./audit";
import { ROLES, UNIT_TYPES } from "./constants";

export const unitSelect = {
  id: true,
  name: true,
  slug: true,
  type: true,
  active: true,
};

export function serializeUnit(unit) {
  if (!unit) return null;
  return {
    id: unit.id,
    name: unit.name,
    slug: unit.slug,
    type: unit.type,
    active: unit.active !== false,
  };
}

export function isAdminRole(role) {
  return role === ROLES.ADMIN;
}

export function allowedUnitIds(session) {
  return (session?.units || []).map((unit) => unit.id);
}

export function hasUnitAccess(session, unitId) {
  if (!session) return false;
  if (isAdminRole(session.role)) return true;
  return allowedUnitIds(session).includes(Number(unitId));
}

export function requireActiveUnit(session) {
  const unitId = Number(session?.activeUnitId);
  if (!Number.isInteger(unitId) || unitId <= 0) {
    throw forbidden("Seu usuário não tem uma unidade ativa. Peça ao administrador para vincular uma loja.");
  }
  return unitId;
}

export function assertUnitAccess(session, unitId) {
  if (isAdminRole(session.role)) return;
  if (!hasUnitAccess(session, unitId)) {
    throw forbidden("Você não tem acesso a esta unidade.");
  }
}

export function canViewProduct(session, product) {
  if (!session || !product) return false;
  if (isAdminRole(session.role)) return true;
  const ids = allowedUnitIds(session);
  return ids.includes(product.unitId) || (product.transferToUnitId != null && ids.includes(product.transferToUnitId));
}

export function assertCanViewProduct(session, product) {
  if (!canViewProduct(session, product)) {
    throw notFound("Produto não encontrado.");
  }
}

export function assertProductInActiveUnit(session, product) {
  const unitId = requireActiveUnit(session);
  if (product.unitId !== unitId) {
    throw forbidden("Troque para a unidade deste produto para continuar.");
  }
}

export function assertProductWritable(session, product) {
  assertProductInActiveUnit(session, product);
  if (product.status === "EM_TRANSITO") {
    throw forbidden("Este produto está em trânsito. Conclua ou cancele a transferência para alterá-lo.");
  }
}

export function productUnitWhere(session) {
  return { unitId: requireActiveUnit(session) };
}

export function movementUnitWhere(unitId) {
  return {
    OR: [{ previousUnitId: unitId }, { newUnitId: unitId }],
  };
}

export async function listActiveUnits() {
  const items = await prisma.unit.findMany({
    where: { active: true },
    select: unitSelect,
    orderBy: [{ type: "asc" }, { name: "asc" }],
  });
  return sortUnits(items);
}

export function sortUnits(items) {
  const rank = { [UNIT_TYPES.HQ]: 0, [UNIT_TYPES.BRANCH]: 1 };
  return [...items].sort((a, b) => {
    const typeDiff = (rank[a.type] ?? 9) - (rank[b.type] ?? 9);
    if (typeDiff !== 0) return typeDiff;
    return String(a.name).localeCompare(String(b.name), "pt-BR");
  });
}

export async function resolveAllowedUnits(user) {
  const all = await listActiveUnits();
  if (isAdminRole(user.role)) return all;
  const assignedIds = new Set((user.units || []).map((item) => item.unit?.id ?? item.unitId ?? item.id));
  return all.filter((unit) => assignedIds.has(unit.id));
}

export async function getUnitOrThrow(id) {
  const unit = await prisma.unit.findUnique({
    where: { id: Number(id) },
    select: unitSelect,
  });
  if (!unit) throw validationError("Unidade inválida.");
  if (!unit.active) throw validationError("Esta unidade está inativa.");
  return unit;
}

export async function listUnits({ includeInactive = false } = {}) {
  const items = await prisma.unit.findMany({
    where: includeInactive ? {} : { active: true },
    select: unitSelect,
  });
  return sortUnits(items);
}

export function slugifyUnitName(name) {
  const base = String(name || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72);
  return base || "unidade";
}

async function uniqueSlug(base, excludeId) {
  let slug = base;
  let suffix = 2;
  while (true) {
    const found = await prisma.unit.findFirst({
      where: { slug, ...(excludeId ? { id: { not: excludeId } } : {}) },
      select: { id: true },
    });
    if (!found) return slug;
    slug = `${base.slice(0, 76)}-${suffix}`.slice(0, 80);
    suffix += 1;
  }
}

function duplicateUnitError(error) {
  if (error?.code === "P2002") {
    throw conflict("Já existe uma unidade com este nome.");
  }
  throw error;
}

export async function createUnit(payload, actor) {
  const name = String(payload.name || "").trim();
  const type = payload.type || UNIT_TYPES.BRANCH;
  if (!name) throw validationError("Informe o nome da unidade.");
  if (!Object.values(UNIT_TYPES).includes(type)) throw validationError("Tipo de unidade inválido.");

  const exists = await prisma.unit.findFirst({ where: { name } });
  if (exists) throw conflict("Já existe uma unidade com este nome.");

  const slug = await uniqueSlug(slugifyUnitName(name));

  try {
    const unit = await prisma.unit.create({
      data: { name, slug, type, active: true },
      select: unitSelect,
    });
    await writeAudit({
      userId: actor.id,
      action: "UNIT_CREATED",
      entity: "unit",
      entityId: unit.id,
      newData: unit,
    });
    return unit;
  } catch (error) {
    duplicateUnitError(error);
  }
}

export async function updateUnit(id, payload, actor) {
  const current = await prisma.unit.findUnique({
    where: { id: Number(id) },
    select: unitSelect,
  });
  if (!current) throw notFound("Unidade não encontrada.");

  const data = {};
  if (payload.name !== undefined) {
    const name = String(payload.name || "").trim();
    if (!name) throw validationError("Informe o nome da unidade.");
    data.name = name;
  }
  if (payload.type !== undefined) {
    if (!Object.values(UNIT_TYPES).includes(payload.type)) throw validationError("Tipo de unidade inválido.");
    data.type = payload.type;
  }
  if (payload.active !== undefined) {
    data.active = Boolean(payload.active);
    if (!data.active) {
      const otherActive = await prisma.unit.count({ where: { active: true, id: { not: current.id } } });
      if (!otherActive) throw validationError("Mantenha ao menos uma unidade ativa.");
    }
  }

  if (data.name && data.name !== current.name) {
    const exists = await prisma.unit.findFirst({ where: { name: data.name, id: { not: current.id } } });
    if (exists) throw conflict("Já existe uma unidade com este nome.");
  }

  try {
    const unit = await prisma.unit.update({
      where: { id: current.id },
      data,
      select: unitSelect,
    });
    await writeAudit({
      userId: actor.id,
      action: "UNIT_UPDATED",
      entity: "unit",
      entityId: unit.id,
      oldData: current,
      newData: unit,
    });
    return unit;
  } catch (error) {
    duplicateUnitError(error);
  }
}
