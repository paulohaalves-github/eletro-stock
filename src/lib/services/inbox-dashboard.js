import { prisma } from "../db";
import {
  CONVERSATION_STATUS_LABELS,
  CONVERSATION_STATUSES,
  INBOX_PROVIDER_LABELS,
  LEAD_STAGE_LABELS,
  LEAD_STAGES,
  SALE_ORDER_ITEM_STATUSES,
} from "../constants";
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

const LEAD_STAGE_ORDER = [
  LEAD_STAGES.NEW,
  LEAD_STAGES.QUALIFYING,
  LEAD_STAGES.INTERESTED,
  LEAD_STAGES.WAITLIST,
  LEAD_STAGES.IN_SALE,
  LEAD_STAGES.CONVERTED,
  LEAD_STAGES.AFTER_SALES,
  LEAD_STAGES.NO_REPLY,
  LEAD_STAGES.DISCARDED,
];

function emptyCounts() {
  return { waiting: 0, replied: 0, closed: 0, unassigned: 0, total: 0, open: 0 };
}

function emptyLeadCounts() {
  return { leads: 0, converted: 0, inSale: 0, open: 0, lost: 0, amount: 0, soldItems: 0 };
}

function soldAmount(value) {
  if (value == null || value === "") return null;
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : null;
}

function itemSoldAmount(item) {
  const fromSale = soldAmount(item.sale?.cashPrice);
  if (fromSale != null) return fromSale;
  const fromItem = soldAmount(item.cashPrice);
  return fromItem != null ? fromItem : 0;
}

function averageTicket(amount, converted) {
  if (!converted) return 0;
  return amount / converted;
}

function bump(bucket, status, agentId) {
  bucket.total += 1;
  if (status === CONVERSATION_STATUSES.WAITING_AGENT) bucket.waiting += 1;
  else if (status === CONVERSATION_STATUSES.AGENT_REPLIED) bucket.replied += 1;
  else if (status === CONVERSATION_STATUSES.CLOSED) bucket.closed += 1;
  if (status !== CONVERSATION_STATUSES.CLOSED) bucket.open += 1;
  if (!agentId && status !== CONVERSATION_STATUSES.CLOSED) bucket.unassigned += 1;
}

function classifyLead(stage) {
  if (stage === LEAD_STAGES.CONVERTED) return "converted";
  if (stage === LEAD_STAGES.IN_SALE) return "inSale";
  if (stage === LEAD_STAGES.DISCARDED || stage === LEAD_STAGES.NO_REPLY) return "lost";
  return "open";
}

function bumpLead(bucket, stage) {
  bucket.leads += 1;
  const kind = classifyLead(stage);
  bucket[kind] += 1;
}

function conversionRate(converted, leads) {
  if (!leads) return 0;
  return converted / leads;
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
      leads: 0,
      converted: 0,
      inSale: 0,
      lost: 0,
      conversionRate: 0,
      convertedAmount: 0,
      ticket: 0,
    },
    byStatus: STATUS_ORDER.map((status) => ({
      status,
      label: STATUS_SHORT_LABELS[status] || CONVERSATION_STATUS_LABELS[status],
      count: 0,
    })),
    byLeadStage: LEAD_STAGE_ORDER.map((stage) => ({
      stage,
      label: LEAD_STAGE_LABELS[stage] || stage,
      count: 0,
    })),
    byTeam: [],
    byAgent: [],
    byChannel: [],
    leadsByChannel: [],
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
    phoneNumber: channel.phoneNumber || null,
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
        id: true,
        teamId: true,
        agentId: true,
        channelId: true,
        status: true,
        commercialStage: true,
        waitingSince: true,
        closedAt: true,
        agent: { select: { id: true, name: true } },
        channel: { select: { id: true, name: true, phoneNumber: true, provider: true } },
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
      select: { id: true, name: true, phoneNumber: true, provider: true },
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
  const leadsByChannel = new Map(
    scopedChannels.map((channel) => [
      channel.id,
      { ...channel, ...emptyLeadCounts() },
    ]),
  );
  const byAgent = new Map();
  const byStatus = Object.fromEntries(STATUS_ORDER.map((status) => [status, 0]));
  const byLeadStage = Object.fromEntries(LEAD_STAGE_ORDER.map((stage) => [stage, 0]));
  const leadTotals = emptyLeadCounts();

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
    const stage = row.commercialStage || LEAD_STAGES.NEW;
    byLeadStage[stage] = (byLeadStage[stage] || 0) + 1;
    bumpLead(leadTotals, stage);

    const team = byTeam.get(row.teamId);
    if (team) bump(team, row.status, row.agentId);

    if (row.channelId) {
      if (!byChannel.has(row.channelId)) {
        const channelMeta = {
          id: row.channelId,
          name: row.channel?.name || "Canal",
          provider: row.channel?.provider || "",
          providerLabel: INBOX_PROVIDER_LABELS[row.channel?.provider] || row.channel?.provider || "Canal",
        };
        byChannel.set(row.channelId, { ...channelMeta, ...emptyCounts() });
        leadsByChannel.set(row.channelId, { ...channelMeta, ...emptyLeadCounts() });
      }
      bump(byChannel.get(row.channelId), row.status, row.agentId);
      bumpLead(leadsByChannel.get(row.channelId), stage);
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

  const conversationIds = conversations.map((row) => row.id);
  const channelByConversation = new Map(conversations.map((row) => [row.id, row.channelId]));

  if (conversationIds.length) {
    const soldItems = await prisma.saleOrderItem.findMany({
      where: {
        status: SALE_ORDER_ITEM_STATUSES.SOLD,
        saleOrder: { conversationId: { in: conversationIds } },
      },
      select: {
        cashPrice: true,
        sale: { select: { cashPrice: true } },
        saleOrder: { select: { conversationId: true } },
      },
    });

    for (const item of soldItems) {
      const amount = itemSoldAmount(item);
      const conversationId = item.saleOrder?.conversationId;
      const itemChannelId = channelByConversation.get(conversationId);
      leadTotals.amount += amount;
      leadTotals.soldItems += 1;
      if (itemChannelId && leadsByChannel.has(itemChannelId)) {
        const bucket = leadsByChannel.get(itemChannelId);
        bucket.amount += amount;
        bucket.soldItems += 1;
      }
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
      leads: leadTotals.leads,
      converted: leadTotals.converted,
      inSale: leadTotals.inSale,
      lost: leadTotals.lost,
      conversionRate: conversionRate(leadTotals.converted, leadTotals.leads),
      convertedAmount: leadTotals.amount,
      ticket: averageTicket(leadTotals.amount, leadTotals.converted),
    },
    byStatus: STATUS_ORDER.map((status) => ({
      status,
      label: STATUS_SHORT_LABELS[status] || CONVERSATION_STATUS_LABELS[status],
      count: byStatus[status] || 0,
    })),
    byLeadStage: LEAD_STAGE_ORDER.map((stage) => ({
      stage,
      label: LEAD_STAGE_LABELS[stage] || stage,
      count: byLeadStage[stage] || 0,
    })).filter((row) => row.count > 0 || LEAD_STAGE_ORDER.includes(row.stage)),
    byTeam: [...byTeam.values()].sort((a, b) => b.open - a.open || a.name.localeCompare(b.name, "pt-BR")),
    byAgent: agents,
    byChannel: [...byChannel.values()].sort((a, b) => b.open - a.open || a.name.localeCompare(b.name, "pt-BR")),
    leadsByChannel: [...leadsByChannel.values()]
      .map((row) => ({
        ...row,
        conversionRate: conversionRate(row.converted, row.leads),
        ticket: averageTicket(row.amount, row.converted),
      }))
      .sort((a, b) => b.leads - a.leads || a.name.localeCompare(b.name, "pt-BR")),
    channels: channelOptions,
  };
}
