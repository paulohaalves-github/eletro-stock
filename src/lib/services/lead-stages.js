import { prisma } from "../db";
import { conflict, forbidden, notFound, validationError } from "../errors";
import {
  CONVERSATION_EVENT_TYPES,
  INBOX_TEAM_MEMBER_ROLES,
  isSaleOrderClosed,
  LEAD_AGENT_STAGES,
  LEAD_BOARD_STAGES,
  LEAD_STAGE_LABELS,
  LEAD_STAGES,
  SALE_ORDER_STATUSES,
} from "../constants";
import { assertInboxTeamAccess, getAgentTeamIds, getInboxMemberships, getSupervisedTeamIds, isInboxAdmin } from "./inbox-access";
import {
  clearConversationWaitlist,
  rematchConversation,
  saveConversationWaitlist,
  waitlistCriteriaFromPayload,
} from "./waitlist";

const REENTRY_STAGES = new Set([
  LEAD_STAGES.NO_REPLY,
  LEAD_STAGES.DISCARDED,
  LEAD_STAGES.CONVERTED,
]);

function stageLabel(stage) {
  return LEAD_STAGE_LABELS[stage] || stage;
}

export async function moveLeadStage(db, conversationId, stage, { userId = null, reason } = {}) {
  const id = Number(conversationId);
  if (!id || !LEAD_STAGE_LABELS[stage]) return null;
  const conversation = await db.inboxConversation.findUnique({
    where: { id },
    select: { id: true, commercialStage: true },
  });
  if (!conversation || conversation.commercialStage === stage) return conversation;
  await db.inboxConversation.update({
    where: { id },
    data: { commercialStage: stage, commercialStageAt: new Date() },
  });
  await db.inboxConversationEvent.create({
    data: {
      conversationId: id,
      type: CONVERSATION_EVENT_TYPES.STAGE,
      message: reason || `Etapa comercial: ${stageLabel(stage)}.`,
      userId: userId || null,
    },
  });
  if (conversation.commercialStage === LEAD_STAGES.WAITLIST) {
    await clearConversationWaitlist(db, id);
  }
  return { ...conversation, commercialStage: stage };
}

export async function advanceLeadOnAccept(db, conversation, userId, agentName) {
  if (!conversation || conversation.commercialStage !== LEAD_STAGES.NEW) return;
  await moveLeadStage(db, conversation.id, LEAD_STAGES.QUALIFYING, {
    userId,
    reason: `${agentName} assumiu a conversa. Etapa comercial: Em qualificação.`,
  });
}

export async function advanceLeadOnCustomerMessage(db, conversation) {
  if (!conversation || !REENTRY_STAGES.has(conversation.commercialStage)) return;
  await moveLeadStage(db, conversation.id, LEAD_STAGES.QUALIFYING, {
    reason: "O cliente enviou uma nova mensagem. Etapa comercial: Em qualificação.",
  });
}

async function salesOfConversation(db, conversationId) {
  return db.saleOrder.findMany({
    where: { conversationId: Number(conversationId) },
    select: { id: true, status: true, closedAt: true },
  });
}

function hasConvertedSale(orders) {
  return orders.some(
    (order) => order.status === SALE_ORDER_STATUSES.COMPLETED
      || (order.status === SALE_ORDER_STATUSES.PARTIAL && order.closedAt),
  );
}

export async function syncLeadStageWithSales(db, conversationId, { userId = null, prefer } = {}) {
  const id = Number(conversationId);
  if (!id) return;
  const orders = await salesOfConversation(db, id);
  if (orders.some((order) => !isSaleOrderClosed(order))) {
    await moveLeadStage(db, id, LEAD_STAGES.IN_SALE, {
      userId,
      reason: "A conversa acompanhou a venda aberta.",
    });
    return;
  }
  if (prefer === "lost") {
    await moveLeadStage(db, id, LEAD_STAGES.NO_REPLY, {
      userId,
      reason: "A venda foi encerrada sem concretizar. Etapa comercial: Sem retorno.",
    });
    return;
  }
  if (prefer === "converted") {
    await moveLeadStage(db, id, LEAD_STAGES.CONVERTED, {
      userId,
      reason: "A venda foi concretizada. A conversa saiu do quadro de leads.",
    });
    return;
  }

  const current = await db.inboxConversation.findUnique({
    where: { id },
    select: { commercialStage: true },
  });
  if (!current) return;
  if (current.commercialStage !== LEAD_STAGES.IN_SALE && current.commercialStage !== LEAD_STAGES.CONVERTED) return;
  if (hasConvertedSale(orders)) {
    await moveLeadStage(db, id, LEAD_STAGES.CONVERTED, {
      userId,
      reason: "A conversa saiu do quadro de leads.",
    });
    return;
  }
  await moveLeadStage(db, id, LEAD_STAGES.QUALIFYING, {
    userId,
    reason: "A venda vinculada foi removida. Etapa comercial: Em qualificação.",
  });
}

export async function setConversationLeadStage(id, stage, session, payload = {}) {
  const next = String(stage || "").trim();
  if (!LEAD_AGENT_STAGES.includes(next)) {
    throw validationError("Escolha uma etapa do quadro de leads.");
  }
  const conversation = await prisma.inboxConversation.findUnique({
    where: { id: Number(id) },
    select: { id: true, teamId: true, agentId: true, commercialStage: true },
  });
  if (!conversation) throw notFound("Conversa não encontrada.");
  await assertInboxTeamAccess(session, conversation.teamId);
  if (!isInboxAdmin(session)) {
    const supervised = await getSupervisedTeamIds(session);
    const assignedToMe = Number(conversation.agentId) === Number(session.id);
    if (!supervised.includes(Number(conversation.teamId)) && !assignedToMe) {
      throw forbidden("Você só acompanha as conversas atribuídas a você.");
    }
  }
  if (conversation.commercialStage === LEAD_STAGES.IN_SALE) {
    throw conflict("Esta conversa está em uma venda aberta. A etapa acompanha o pedido.");
  }
  if (next === LEAD_STAGES.WAITLIST) {
    await saveConversationWaitlist(prisma, conversation.id, waitlistCriteriaFromPayload(payload));
  }
  await moveLeadStage(prisma, conversation.id, next, {
    userId: session.id,
    reason: `${session.name} marcou a etapa comercial como ${stageLabel(next)}.`,
  });
  if (next === LEAD_STAGES.WAITLIST) {
    await rematchConversation(conversation.id);
  }
}

const leadCardSelect = {
  id: true,
  phone: true,
  contactName: true,
  commercialStage: true,
  commercialStageAt: true,
  waitlistCommercialName: true,
  waitlistModelCode: true,
  waitlistCapacity: true,
  waitlistVoltage: true,
  waitlistCondition: true,
  waitlistCategoryId: true,
  waitlistLineId: true,
  lastMessagePreview: true,
  lastMessageAt: true,
  status: true,
  teamId: true,
  team: { select: { id: true, name: true, color: true } },
  customer: { select: { id: true, name: true } },
  agent: { select: { id: true, name: true } },
  waitlistMatches: {
    select: {
      product: {
        select: {
          id: true,
          serialOnyx: true,
          catalogModel: { select: { commercialName: true } },
        },
      },
    },
  },
};

async function leadVisibility(session) {
  if (isInboxAdmin(session)) {
    const teamIds = await getAgentTeamIds(session);
    return { teamIds, where: { teamId: { in: teamIds } } };
  }
  const [supervised, memberships] = await Promise.all([
    getSupervisedTeamIds(session),
    getInboxMemberships(session.id),
  ]);
  const agentTeamIds = memberships
    .filter((item) => item.role !== INBOX_TEAM_MEMBER_ROLES.SUPERVISOR)
    .map((item) => item.teamId);
  const teamIds = [...new Set([...supervised, ...agentTeamIds])];
  const or = [];
  if (supervised.length) or.push({ teamId: { in: supervised } });
  if (agentTeamIds.length) or.push({ teamId: { in: agentTeamIds }, agentId: Number(session.id) });
  return { teamIds, where: or.length ? { OR: or } : { id: -1 } };
}

export async function listLeadBoard(filters, session) {
  const { teamIds, where: visibility } = await leadVisibility(session);
  if (!teamIds.length) return { items: [], total: 0, truncated: false };

  const where = {
    ...visibility,
    commercialStage: { in: LEAD_BOARD_STAGES },
  };
  if (filters.teamId) {
    const teamId = Number(filters.teamId);
    if (!teamIds.includes(teamId)) throw forbidden("Você não pertence a esta equipe.");
    where.teamId = teamId;
  }
  const text = String(filters.q || "").trim();
  if (text) {
    const search = {
      OR: [
        { phone: { contains: text } },
        { contactName: { contains: text } },
        { customer: { name: { contains: text } } },
        { lastMessagePreview: { contains: text } },
      ],
    };
    if (where.OR) {
      where.AND = [{ OR: where.OR }, search];
      delete where.OR;
    } else {
      where.OR = search.OR;
    }
  }

  const total = await prisma.inboxConversation.count({ where });
  const items = await prisma.inboxConversation.findMany({
    where,
    select: leadCardSelect,
    orderBy: [{ lastMessageAt: "desc" }, { commercialStageAt: "desc" }],
    take: 400,
  });
  return {
    items: items.map((item) => ({
      ...item,
      displayName: item.customer?.name || item.contactName || item.phone,
    })),
    total,
    truncated: total > items.length,
  };
}
