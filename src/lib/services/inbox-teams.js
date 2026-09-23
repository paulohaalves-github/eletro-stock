import { prisma } from "../db";
import { conflict, notFound, validationError } from "../errors";
import { writeAudit } from "../audit";
import { INBOX_TEAM_MEMBER_ROLES } from "../constants";
import { emptyToNull, parseId } from "../validations";
import { paginationResult, parsePagination } from "../pagination";

const teamSelect = {
  id: true,
  name: true,
  slug: true,
  color: true,
  active: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { members: true, conversations: true, channels: true } },
};

function slugify(name) {
  const slug = String(name || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return slug || "equipe";
}

function serializeMember(member) {
  return {
    teamId: member.teamId,
    userId: member.userId,
    role: member.role,
    conversationLimit: member.conversationLimit,
    user: member.user,
  };
}

function serializeTeam(team) {
  if (!team) return null;
  return {
    id: team.id,
    name: team.name,
    slug: team.slug,
    color: team.color,
    active: team.active,
    createdAt: team.createdAt,
    updatedAt: team.updatedAt,
    memberCount: team._count?.members ?? team.members?.length ?? 0,
    conversationCount: team._count?.conversations ?? 0,
    channelCount: team._count?.channels ?? 0,
    members: (team.members || []).map(serializeMember),
  };
}

async function uniqueSlug(name, excludeId) {
  const base = slugify(name);
  let slug = base;
  let n = 2;
  while (true) {
    const found = await prisma.inboxTeam.findUnique({ where: { slug } });
    if (!found || found.id === excludeId) return slug;
    slug = `${base}-${n}`.slice(0, 80);
    n += 1;
  }
}

export async function listInboxTeams({ q, active, page, pageSize } = {}) {
  const where = {};
  const text = String(q || "").trim();
  if (text) {
    where.OR = [{ name: { contains: text } }, { slug: { contains: text } }];
  }
  if (active === "true") where.active = true;
  if (active === "false") where.active = false;

  const pagination = parsePagination({ page, pageSize }, { defaultAll: true });
  const [total, items] = await Promise.all([
    prisma.inboxTeam.count({ where }),
    prisma.inboxTeam.findMany({
      where,
      select: {
        ...teamSelect,
        members: {
          include: { user: { select: { id: true, name: true, email: true, role: true, active: true } } },
          orderBy: { user: { name: "asc" } },
        },
      },
      orderBy: { name: "asc" },
      skip: pagination.skip,
      take: pagination.take,
    }),
  ]);
  return paginationResult(items.map(serializeTeam), total, pagination);
}

export async function getInboxTeam(id) {
  const team = await prisma.inboxTeam.findUnique({
    where: { id: Number(id) },
    select: {
      ...teamSelect,
      members: {
        include: { user: { select: { id: true, name: true, email: true, role: true, active: true } } },
        orderBy: { user: { name: "asc" } },
      },
    },
  });
  if (!team) throw notFound("Equipe não encontrada.");
  return serializeTeam(team);
}

export async function createInboxTeam(payload, actor) {
  const name = String(payload.name || "").trim();
  if (!name) throw validationError("Informe o nome da equipe.");
  const color = String(payload.color || "#22d3ee").trim() || "#22d3ee";
  const exists = await prisma.inboxTeam.findUnique({ where: { name } });
  if (exists) throw conflict("Já existe uma equipe com este nome.");

  const team = await prisma.inboxTeam.create({
    data: {
      name,
      slug: await uniqueSlug(name),
      color,
      active: payload.active !== false,
    },
    select: teamSelect,
  });
  await writeAudit({
    userId: actor.id,
    action: "INBOX_TEAM_CREATED",
    entity: "inbox_team",
    entityId: team.id,
    newData: team,
  });
  return getInboxTeam(team.id);
}

export async function updateInboxTeam(id, payload, actor) {
  const current = await prisma.inboxTeam.findUnique({ where: { id: Number(id) } });
  if (!current) throw notFound("Equipe não encontrada.");

  const data = {};
  if (payload.name !== undefined) {
    data.name = String(payload.name || "").trim();
    if (!data.name) throw validationError("Informe o nome da equipe.");
    const exists = await prisma.inboxTeam.findUnique({ where: { name: data.name } });
    if (exists && exists.id !== current.id) throw conflict("Já existe uma equipe com este nome.");
    data.slug = await uniqueSlug(data.name, current.id);
  }
  if (payload.color !== undefined) data.color = String(payload.color || "#22d3ee").trim() || "#22d3ee";
  if (payload.active !== undefined) data.active = Boolean(payload.active);

  const team = await prisma.inboxTeam.update({
    where: { id: current.id },
    data,
    select: teamSelect,
  });
  await writeAudit({
    userId: actor.id,
    action: "INBOX_TEAM_UPDATED",
    entity: "inbox_team",
    entityId: team.id,
    oldData: current,
    newData: team,
  });
  return getInboxTeam(team.id);
}

export async function replaceInboxTeamMembers(id, members, actor) {
  const team = await prisma.inboxTeam.findUnique({ where: { id: Number(id) } });
  if (!team) throw notFound("Equipe não encontrada.");

  const list = Array.isArray(members) ? members : [];
  const rows = [];
  const seen = new Set();
  for (const item of list) {
    const userId = parseId(item.userId);
    if (seen.has(userId)) continue;
    seen.add(userId);
    const role = String(item.role || INBOX_TEAM_MEMBER_ROLES.AGENT);
    if (!Object.values(INBOX_TEAM_MEMBER_ROLES).includes(role)) {
      throw validationError("Papel do agente inválido.");
    }
    const conversationLimit = Number(item.conversationLimit || 0);
    rows.push({
      teamId: team.id,
      userId,
      role,
      conversationLimit: Number.isInteger(conversationLimit) && conversationLimit >= 0 ? conversationLimit : 0,
    });
  }

  if (rows.length) {
    const users = await prisma.user.findMany({
      where: { id: { in: rows.map((row) => row.userId) }, active: true },
      select: { id: true },
    });
    if (users.length !== rows.length) throw validationError("Um ou mais usuários são inválidos.");
  }

  await prisma.$transaction([
    prisma.inboxTeamMember.deleteMany({ where: { teamId: team.id } }),
    ...(rows.length ? [prisma.inboxTeamMember.createMany({ data: rows })] : []),
  ]);

  await writeAudit({
    userId: actor.id,
    action: "INBOX_TEAM_MEMBERS_UPDATED",
    entity: "inbox_team",
    entityId: team.id,
    newData: { memberIds: rows.map((row) => row.userId) },
  });
  return getInboxTeam(team.id);
}

export async function listInboxUsers({ q } = {}) {
  const where = { active: true };
  const text = String(q || "").trim();
  if (text) {
    where.OR = [{ name: { contains: text } }, { email: { contains: text } }];
  }
  const items = await prisma.user.findMany({
    where,
    select: { id: true, name: true, email: true, role: true },
    orderBy: { name: "asc" },
    take: 200,
  });
  return { items };
}
