import { prisma } from "../db";
import { writeAudit } from "../audit";
import { PERMISSION_EFFECTS, ROLE_LABELS, ROLES } from "../constants";
import { notFound, validationError } from "../errors";
import {
  DEFAULT_ROLE_PERMISSIONS,
  PERMISSION_GROUPS,
  PERMISSION_LABELS,
  PERMISSIONS,
  computeEffectivePermissions,
  getDefaultPermissions,
  isKnownPermission,
} from "../permissions";

const ALL_PERMISSIONS = Object.values(PERMISSIONS);

let roleCache = null;
let roleCacheAt = 0;
const ROLE_CACHE_TTL_MS = 15_000;
let seedPromise = null;

export function invalidateRolePermissionCache() {
  roleCache = null;
  roleCacheAt = 0;
}

function defaultRoleMatrix() {
  const matrix = {};
  for (const role of Object.values(ROLES)) {
    matrix[role] = [...getDefaultPermissions(role)];
  }
  return matrix;
}

async function ensureRolePermissionsSeeded() {
  if (seedPromise) return seedPromise;
  seedPromise = (async () => {
    const count = await prisma.rolePermission.count();
    if (count > 0) return;
    const rows = [];
    for (const [role, permissions] of Object.entries(DEFAULT_ROLE_PERMISSIONS)) {
      for (const permission of permissions) {
        rows.push({ role, permission });
      }
    }
    if (rows.length) {
      await prisma.rolePermission.createMany({ data: rows, skipDuplicates: true });
    }
  })().finally(() => {
    seedPromise = null;
  });
  return seedPromise;
}

async function loadRolePermissionMap({ force = false } = {}) {
  const now = Date.now();
  if (!force && roleCache && now - roleCacheAt < ROLE_CACHE_TTL_MS) {
    return roleCache;
  }
  await ensureRolePermissionsSeeded();
  const rows = await prisma.rolePermission.findMany({
    select: { role: true, permission: true },
  });
  const matrix = defaultRoleMatrix();
  const seenRoles = new Set();
  for (const row of rows) {
    if (!seenRoles.has(row.role)) {
      matrix[row.role] = [];
      seenRoles.add(row.role);
    }
    if (isKnownPermission(row.permission)) {
      matrix[row.role].push(row.permission);
    }
  }
  for (const role of Object.values(ROLES)) {
    if (role === ROLES.ADMIN) {
      matrix[role] = [...ALL_PERMISSIONS];
      continue;
    }
    if (!seenRoles.has(role)) {
      matrix[role] = [...getDefaultPermissions(role)];
    } else {
      matrix[role] = [...new Set(matrix[role] || [])];
    }
  }
  roleCache = matrix;
  roleCacheAt = now;
  return matrix;
}

export async function getRolePermissions(role) {
  if (role === ROLES.ADMIN) return [...ALL_PERMISSIONS];
  const matrix = await loadRolePermissionMap();
  return matrix[role] ? [...matrix[role]] : [...getDefaultPermissions(role)];
}

export async function getEffectivePermissions(user) {
  if (!user) return [];
  if (user.role === ROLES.ADMIN) return [...ALL_PERMISSIONS];
  if (Array.isArray(user.permissions) && user.permissionOverridesLoaded) {
    return user.permissions;
  }
  const [rolePermissions, overrides] = await Promise.all([
    getRolePermissions(user.role),
    prisma.userPermission.findMany({
      where: { userId: Number(user.id) },
      select: { permission: true, effect: true },
    }),
  ]);
  return computeEffectivePermissions(user.role, rolePermissions, overrides);
}

export async function attachEffectivePermissions(users) {
  const list = (Array.isArray(users) ? users : [users]).filter(Boolean);
  if (!list.length) return Array.isArray(users) ? [] : null;

  const matrix = await loadRolePermissionMap();
  const ids = [...new Set(list.map((user) => Number(user.id)).filter((id) => Number.isInteger(id) && id > 0))];
  const overrides = ids.length
    ? await prisma.userPermission.findMany({
        where: { userId: { in: ids } },
        select: { userId: true, permission: true, effect: true },
      })
    : [];
  const byUser = new Map();
  for (const item of overrides) {
    const bucket = byUser.get(item.userId) || [];
    bucket.push(item);
    byUser.set(item.userId, bucket);
  }

  const enriched = list.map((user) => {
    const rolePermissions = matrix[user.role] || getDefaultPermissions(user.role);
    const permissions = computeEffectivePermissions(user.role, rolePermissions, byUser.get(Number(user.id)) || []);
    return {
      ...user,
      permissions,
      permissionOverridesLoaded: true,
    };
  });

  return Array.isArray(users) ? enriched : enriched[0];
}

function catalogPayload(roleMatrix) {
  return {
    roles: Object.values(ROLES).map((role) => ({
      role,
      label: ROLE_LABELS[role] || role,
      locked: role === ROLES.ADMIN,
      permissions: role === ROLES.ADMIN ? [...ALL_PERMISSIONS] : [...(roleMatrix[role] || [])],
    })),
    groups: PERMISSION_GROUPS,
    permissionLabels: PERMISSION_LABELS,
    permissions: ALL_PERMISSIONS,
  };
}

export async function getPermissionCatalog() {
  const roleMatrix = await loadRolePermissionMap();
  return catalogPayload(roleMatrix);
}

export async function updateRolePermissions(role, permissions, actor) {
  if (!Object.values(ROLES).includes(role)) throw validationError("Perfil inválido.");
  if (role === ROLES.ADMIN) {
    throw validationError("As permissões do Administrador não podem ser alteradas.");
  }
  const next = [...new Set((Array.isArray(permissions) ? permissions : []).filter(isKnownPermission))];
  const previous = await getRolePermissions(role);

  await prisma.$transaction(async (tx) => {
    await tx.rolePermission.deleteMany({ where: { role } });
    if (next.length) {
      await tx.rolePermission.createMany({
        data: next.map((permission) => ({ role, permission })),
      });
    }
  });

  invalidateRolePermissionCache();

  await writeAudit({
    userId: actor.id,
    action: "ROLE_PERMISSIONS_UPDATED",
    entity: "role_permission",
    entityId: role,
    oldData: { role, permissions: previous },
    newData: { role, permissions: next },
  });

  return getPermissionCatalog();
}

export async function getUserPermissionDetail(userId) {
  const user = await prisma.user.findUnique({
    where: { id: Number(userId) },
    select: { id: true, name: true, email: true, role: true, active: true },
  });
  if (!user) throw notFound("Usuário não encontrado.");

  const [rolePermissions, overrides] = await Promise.all([
    getRolePermissions(user.role),
    prisma.userPermission.findMany({
      where: { userId: user.id },
      select: { permission: true, effect: true },
    }),
  ]);
  const effective = computeEffectivePermissions(user.role, rolePermissions, overrides);

  return {
    user,
    rolePermissions,
    overrides,
    effective,
    locked: user.role === ROLES.ADMIN,
    groups: PERMISSION_GROUPS,
    permissionLabels: PERMISSION_LABELS,
    permissions: ALL_PERMISSIONS,
  };
}

export async function updateUserPermissionOverrides(userId, effectivePermissions, actor) {
  const user = await prisma.user.findUnique({
    where: { id: Number(userId) },
    select: { id: true, name: true, email: true, role: true },
  });
  if (!user) throw notFound("Usuário não encontrado.");
  if (user.role === ROLES.ADMIN) {
    throw validationError("As permissões do Administrador não podem ser personalizadas.");
  }

  const rolePermissions = new Set(await getRolePermissions(user.role));
  const wanted = new Set((Array.isArray(effectivePermissions) ? effectivePermissions : []).filter(isKnownPermission));
  const overrides = [];
  for (const permission of ALL_PERMISSIONS) {
    const inRole = rolePermissions.has(permission);
    const enabled = wanted.has(permission);
    if (enabled && !inRole) {
      overrides.push({ userId: user.id, permission, effect: PERMISSION_EFFECTS.GRANT });
    } else if (!enabled && inRole) {
      overrides.push({ userId: user.id, permission, effect: PERMISSION_EFFECTS.DENY });
    }
  }

  const previous = await prisma.userPermission.findMany({
    where: { userId: user.id },
    select: { permission: true, effect: true },
  });

  await prisma.$transaction(async (tx) => {
    await tx.userPermission.deleteMany({ where: { userId: user.id } });
    if (overrides.length) {
      await tx.userPermission.createMany({ data: overrides });
    }
  });

  await writeAudit({
    userId: actor.id,
    action: "USER_PERMISSIONS_UPDATED",
    entity: "user_permission",
    entityId: user.id,
    oldData: { userId: user.id, overrides: previous },
    newData: { userId: user.id, overrides },
  });

  return getUserPermissionDetail(user.id);
}
