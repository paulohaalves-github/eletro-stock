import { prisma } from "../db";
import { conflict, notFound, validationError } from "../errors";
import { writeAudit } from "../audit";
import { ROLES } from "../constants";
import { hashPassword } from "../auth";

export async function listUsers() {
  return prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      active: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

export async function createUser(payload, actor) {
  const name = String(payload.name || "").trim();
  const email = String(payload.email || "").trim().toLowerCase();
  const password = String(payload.password || "");
  const role = payload.role;

  if (!name) throw validationError("Informe o nome.");
  if (!email) throw validationError("Informe o e-mail.");
  if (password.length < 6) throw validationError("A senha deve ter pelo menos 6 caracteres.");
  if (!Object.values(ROLES).includes(role)) throw validationError("Perfil inválido.");

  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) throw conflict("Já existe um usuário com este e-mail.");

  const user = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash: await hashPassword(password),
      role,
      active: payload.active !== false,
    },
    select: { id: true, name: true, email: true, role: true, active: true, createdAt: true },
  });

  await writeAudit({
    userId: actor.id,
    action: "USER_CREATED",
    entity: "user",
    entityId: user.id,
    newData: user,
  });

  return user;
}

export async function updateUser(id, payload, actor) {
  const user = await prisma.user.findUnique({ where: { id: Number(id) } });
  if (!user) throw notFound("Usuário não encontrado.");

  const data = {};
  if (payload.name !== undefined) data.name = String(payload.name).trim();
  if (payload.email !== undefined) data.email = String(payload.email).trim().toLowerCase();
  if (payload.role !== undefined) {
    if (!Object.values(ROLES).includes(payload.role)) throw validationError("Perfil inválido.");
    data.role = payload.role;
  }
  if (payload.active !== undefined) data.active = Boolean(payload.active);
  if (payload.password) {
    if (String(payload.password).length < 6) {
      throw validationError("A senha deve ter pelo menos 6 caracteres.");
    }
    data.passwordHash = await hashPassword(payload.password);
  }

  if (user.id === actor.id && data.active === false) {
    throw validationError("Você não pode desativar o próprio usuário.");
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data,
    select: { id: true, name: true, email: true, role: true, active: true, updatedAt: true },
  });

  await writeAudit({
    userId: actor.id,
    action: "USER_UPDATED",
    entity: "user",
    entityId: user.id,
    oldData: { name: user.name, email: user.email, role: user.role, active: user.active },
    newData: updated,
  });

  return updated;
}

export async function listCategories() {
  return prisma.category.findMany({ orderBy: { name: "asc" } });
}

export async function upsertCategory(payload, actor, id) {
  const name = String(payload.name || "").trim();
  if (!name) throw validationError("Informe o nome da categoria.");

  const exists = await prisma.category.findFirst({
    where: { name, ...(id ? { id: { not: Number(id) } } : {}) },
  });
  if (exists) throw conflict("Já existe uma categoria com este nome.");

  const category = id
    ? await prisma.category.update({
        where: { id: Number(id) },
        data: { name, active: payload.active !== false },
      })
    : await prisma.category.create({ data: { name, active: true } });

  await writeAudit({
    userId: actor.id,
    action: id ? "CATEGORY_UPDATED" : "CATEGORY_CREATED",
    entity: "category",
    entityId: category.id,
    newData: category,
  });

  return category;
}

export async function listLines() {
  return prisma.line.findMany({ orderBy: { name: "asc" } });
}

export async function upsertLine(payload, actor, id) {
  const name = String(payload.name || "").trim();
  if (!name) throw validationError("Informe o nome da linha.");

  const exists = await prisma.line.findFirst({
    where: { name, ...(id ? { id: { not: Number(id) } } : {}) },
  });
  if (exists) throw conflict("Já existe uma linha com este nome.");

  const line = id
    ? await prisma.line.update({
        where: { id: Number(id) },
        data: { name, active: payload.active !== false },
      })
    : await prisma.line.create({ data: { name, active: true } });

  await writeAudit({
    userId: actor.id,
    action: id ? "LINE_UPDATED" : "LINE_CREATED",
    entity: "line",
    entityId: line.id,
    newData: line,
  });

  return line;
}
