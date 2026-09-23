import { prisma } from "../db";
import { CONVERSATION_STATUS_LABELS, CONVERSATION_STATUSES, INBOX_PROVIDER_LABELS } from "../constants";
import { formatDuration, periodRange } from "../format";
import { assertInboxSupervisor } from "./inbox-access";

const STATUS_ORDER = [
  CONVERSATION_STATUSES.WAITING_AGENT,
  CONVERSATION_STATUSES.AGENT_REPLIED,
  CONVERSATION_STATUSES.CLOSED,
];

const STATUS_SHORT_LABELS = {
  [CONVERSATION_STATUSES.WAITING_AGENT]: "Aguardando agente",
  [CONVERSATION_STATUSES.AGENT_REPLIED]: "Agente respondeu",
  [CONVERSATION_STATUSES.CLOSED]: "Encerrada",
};

function emptyCounts() {
  return { waiting: 0, replied: 0, closed: 0, unassigned: 0, total: 0, open: 0 };
}

function bump(bucket, status, agentId) {
  bucket.total += 1;
  if (status === CONVERSATION_STATUSES.WAITING_AGENT) bucket.waiting += 1;
  else if (status === CONVERSATION_STATUSES.AGENT_REPLIED) bucket.replied += 1;
  else if (status === CONVERSATION_STATUSES.CLOSED) bucket.closed += 1;
  if (status !== CONVERSATION_STATUSES.CLOSED) bucket.open += 1;
  if (!agentId && status !== CONVERSATION_STATUSES.CLOSED) bucket.unassigned += 1;
}

function startOfToday(now) {
  const date = new Date(now);
  date.setHours(0, 0, 0, 0);
  return date;
}

function emptyDashboard(channels = []) {
  return {
    cards: {
      open: 0,
      waiting: 0,
      replied: 0,
      closed: 0,
      unassigned: 0,
      closedToday: 0,
      avgWait: "—",
    },
    byStatus: STATUS_ORDER.map((status) => ({
      status,
      label: STATUS_SHORT_LABELS[status] || CONVERSATION_STATUS_LABELS[status],
      count: 0,
    })),
    byTeam: [],
    byAgent: [],
    byChannel: [],
    channels,
  };
}

function parseChannelId(value) {
  if (value == null || value === "") return null;
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function serializeChannel(channel) {
  return {
    id: channel.id,
    name: channel.name,
    provider: channel.provider,
    providerLabel: INBOX_PROVIDER_LABELS[channel.provider] || channel.provider,
  };
}

function conversationWhere({ teamIds, channelId, rangeType, period, from, to }) {
  const where = { teamId: { in: teamIds } };
  if (channelId) where.channelId = channelId;

  const closed = rangeType === "closed";
  if (period === "all" || !period) {
    if (closed) where.status = CONVERSATION_STATUSES.CLOSED;
    return where;
  }

  const range = periodRange(period === "custom" && (!from || !to) ? "30d" : period, from, to);
  if (closed) where.closedAt = { gte: range.start, lte: range.end };
  else where.queuedAt = { gte: range.start, lte: range.end };
  return where;
}

export async function getInboxDashboard(session, filters = {}) {
  const teamIds = await assertInboxSupervisor(session);
  const period = ["all", "today", "7d", "30d", "90d", "custom"].includes(filters.period) ? filters.period : "all";
  const rangeType = filters.rangeType === "closed" ? "closed" : "started";
  const channelId = parseChannelId(filters.channelId);
  if (!teamIds.length) return emptyDashboard();

  const now = new Date();
  const today = startOfToday(now);

  const [conversations, teams, members, channels] = await Promise.all([
    prisma.inboxConversation.findMany({
      where: conversationWhere({ teamIds, channelId, rangeType, period, from: filters.from, to: filters.to }),
      select: {
        teamId: true,
        agentId: true,
        channelId: true,
        status: true,
        waitingSince: true,
        closedAt: true,
        agent: { select: { id: true, name: true } },
        channel: { select: { id: true, name: true, provider: true } },
      },
    }),
    prisma.inboxTeam.findMany({
      where: { id: { in: teamIds } },
      select: { id: true, name: true, color: true },
      orderBy: { name: "asc" },
    }),
    prisma.inboxTeamMember.findMany({
      where: { teamId: { in: teamIds } },
      select: { userId: true, user: { select: { id: true, name: true } } },
    }),
    prisma.inboxChannel.findMany({
      where: {
        OR: [
          { defaultTeamId: { in: teamIds } },
          { conversations: { some: { teamId: { in: teamIds } } } },
        ],
      },
      select: { id: true, name: true, provider: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const channelOptions = channels.map(serializeChannel);
  const scopedChannels = channelId
    ? channelOptions.filter((channel) => channel.id === channelId)
    : channelOptions;

  const byTeam = new Map(teams.map((team) => [team.id, { id: team.id, name: team.name, color: team.color, ...emptyCounts() }]));
  const byChannel = new Map(
    scopedChannels.map((channel) => [
      channel.id,
      { ...channel, ...emptyCounts() },
    ]),
  );
  const byAgent = new Map();
  const byStatus = Object.fromEntries(STATUS_ORDER.map((status) => [status, 0]));

  for (const member of members) {
    if (!member.userId || byAgent.has(member.userId)) continue;
    byAgent.set(member.userId, {
      id: member.userId,
      name: member.user?.name || "Agente",
      ...emptyCounts(),
    });
  }

  const unassigned = { id: null, name: "Sem agente", ...emptyCounts() };
  let waitSum = 0;
  let waitCount = 0;
  let closedToday = 0;

  for (const row of conversations) {
    byStatus[row.status] = (byStatus[row.status] || 0) + 1;
    const team = byTeam.get(row.teamId);
    if (team) bump(team, row.status, row.agentId);

    if (row.channelId) {
      if (!byChannel.has(row.channelId)) {
        byChannel.set(row.channelId, {
          id: row.channelId,
          name: row.channel?.name || "Canal",
          provider: row.channel?.provider || "",
          providerLabel: INBOX_PROVIDER_LABELS[row.channel?.provider] || row.channel?.provider || "Canal",
          ...emptyCounts(),
        });
      }
      bump(byChannel.get(row.channelId), row.status, row.agentId);
    }

    if (row.agentId) {
      if (!byAgent.has(row.agentId)) {
        byAgent.set(row.agentId, { id: row.agentId, name: row.agent?.name || "Agente", ...emptyCounts() });
      }
      bump(byAgent.get(row.agentId), row.status, row.agentId);
    } else {
      bump(unassigned, row.status, row.agentId);
    }

    if (row.status === CONVERSATION_STATUSES.WAITING_AGENT && row.waitingSince) {
      waitSum += Math.max(0, now.getTime() - new Date(row.waitingSince).getTime());
      waitCount += 1;
    }
    if (row.status === CONVERSATION_STATUSES.CLOSED && row.closedAt && new Date(row.closedAt) >= today) {
      closedToday += 1;
    }
  }

  const waiting = byStatus[CONVERSATION_STATUSES.WAITING_AGENT] || 0;
  const replied = byStatus[CONVERSATION_STATUSES.AGENT_REPLIED] || 0;
  const closed = byStatus[CONVERSATION_STATUSES.CLOSED] || 0;
  const avgWait = waitCount ? formatDuration(new Date(now.getTime() - waitSum / waitCount), now) : "—";

  const agents = [...byAgent.values()].sort((a, b) => b.open - a.open || a.name.localeCompare(b.name, "pt-BR"));
  if (unassigned.total > 0) agents.unshift(unassigned);

  return {
    cards: {
      open: waiting + replied,
      waiting,
      replied,
      closed,
      unassigned: unassigned.open,
      closedToday,
      avgWait,
    },
    byStatus: STATUS_ORDER.map((status) => ({
      status,
      label: STATUS_SHORT_LABELS[status] || CONVERSATION_STATUS_LABELS[status],
      count: byStatus[status] || 0,
    })),
    byTeam: [...byTeam.values()].sort((a, b) => b.open - a.open || a.name.localeCompare(b.name, "pt-BR")),
    byAgent: agents,
    byChannel: [...byChannel.values()].sort((a, b) => b.open - a.open || a.name.localeCompare(b.name, "pt-BR")),
    channels: channelOptions,
  };
}
