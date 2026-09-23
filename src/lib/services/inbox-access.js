import { prisma } from "../db";
import { forbidden } from "../errors";
import { INBOX_TEAM_MEMBER_ROLES, ROLES } from "../constants";
import { can, PERMISSIONS } from "../permissions";

export function isInboxAdmin(session) {
  return session?.role === ROLES.ADMIN || session?.role === ROLES.GESTOR;
}

export async function resolveInboxSupervisor(session) {
  if (!session?.id) return false;
  if (isInboxAdmin(session)) return true;
  const member = await prisma.inboxTeamMember.findFirst({
    where: {
      userId: Number(session.id),
      role: INBOX_TEAM_MEMBER_ROLES.SUPERVISOR,
      team: { active: true },
    },
    select: { id: true },
  });
  return Boolean(member);
}

export async function getInboxMemberships(userId) {
  return prisma.inboxTeamMember.findMany({
    where: { userId: Number(userId), team: { active: true } },
    select: {
      teamId: true,
      role: true,
      conversationLimit: true,
      team: { select: { id: true, name: true, color: true, active: true } },
    },
  });
}

export async function getAgentTeamIds(session) {
  if (!session) return [];
  if (isInboxAdmin(session)) {
    const teams = await prisma.inboxTeam.findMany({ where: { active: true }, select: { id: true } });
    return teams.map((team) => team.id);
  }
  const memberships = await getInboxMemberships(session.id);
  return memberships.map((item) => item.teamId);
}

export async function getSupervisedTeamIds(session) {
  if (!session) return [];
  if (isInboxAdmin(session)) {
    const teams = await prisma.inboxTeam.findMany({ where: { active: true }, select: { id: true } });
    return teams.map((team) => team.id);
  }
  const memberships = await prisma.inboxTeamMember.findMany({
    where: {
      userId: Number(session.id),
      role: INBOX_TEAM_MEMBER_ROLES.SUPERVISOR,
      team: { active: true },
    },
    select: { teamId: true },
  });
  return memberships.map((item) => item.teamId);
}

export async function assertInboxSupervisor(session) {
  const teamIds = await getSupervisedTeamIds(session);
  if (!isInboxAdmin(session) && teamIds.length === 0) {
    throw forbidden("Apenas supervisores acessam este painel.");
  }
  return teamIds;
}

export async function assertInboxTeamAccess(session, teamId, { assign = false } = {}) {
  if (isInboxAdmin(session)) return { admin: true, role: "SUPERVISOR" };
  const member = await prisma.inboxTeamMember.findUnique({
    where: { teamId_userId: { teamId: Number(teamId), userId: session.id } },
  });
  if (!member) throw forbidden("Você não pertence a esta equipe.");
  if (assign && member.role !== "SUPERVISOR" && !can(session.role, PERMISSIONS.INBOX_ASSIGN)) {
    throw forbidden("Você não pode transferir esta conversa.");
  }
  return member;
}
