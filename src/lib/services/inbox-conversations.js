import { prisma } from "../db";
import { conflict, forbidden, notFound, validationError } from "../errors";
import {
  CONVERSATION_EVENT_TYPES,
  CONVERSATION_STATUSES,
  INBOX_CONNECTION_STATUSES,
  INBOX_PROVIDERS,
  MESSAGE_DIRECTIONS,
  MESSAGE_STATUSES,
} from "../constants";
import { paginationResult, parsePagination } from "../pagination";
import { emptyToNull, parseId } from "../validations";
import { digitsOnly, normalizeWhatsAppPhone, phoneMatchVariants } from "../phone";
import { addCustomerPhone, serializeCustomer } from "./customers";
import { assertInboxTeamAccess, getAgentTeamIds, isInboxAdmin } from "./inbox-access";
import { getInboxChannelRecord } from "./inbox-channels";
import { inboxMediaPreview, saveInboxAttachment } from "./inbox-media";
import { sendDialog360Message } from "../whatsapp/dialog360";
import { sendUnofficialMessage } from "../whatsapp/unofficial";
import { applyInboundAutomations, scheduleUnansweredAutomations } from "./inbox-automations";

const userLite = { select: { id: true, name: true, email: true } };
const teamLite = { select: { id: true, name: true, color: true } };
const channelLite = {
  select: { id: true, name: true, provider: true, phoneNumber: true, connectionStatus: true, type: true },
};

const conversationListSelect = {
  id: true,
  channelId: true,
  teamId: true,
  customerId: true,
  agentId: true,
  acceptedById: true,
  closedById: true,
  phone: true,
  whatsappJid: true,
  contactName: true,
  status: true,
  lastMessagePreview: true,
  lastMessageDirection: true,
  lastMessageAt: true,
  lastCustomerMessageAt: true,
  lastAgentMessageAt: true,
  queuedAt: true,
  acceptedAt: true,
  firstResponseAt: true,
  closedAt: true,
  reopenedAt: true,
  waitingSince: true,
  unreadCount: true,
  createdAt: true,
  updatedAt: true,
  channel: channelLite,
  team: teamLite,
  customer: {
    select: {
      id: true,
      name: true,
      phone: true,
      phones: { orderBy: [{ primary: "desc" }, { createdAt: "asc" }] },
    },
  },
  agent: userLite,
  acceptedBy: userLite,
  closedBy: userLite,
};

function previewOf(body, mediaType, fileName) {
  return inboxMediaPreview(body, mediaType, mediaType, fileName);
}

function serializeConversation(conversation) {
  if (!conversation) return null;
  const now = new Date();
  const waiting =
    conversation.status === CONVERSATION_STATUSES.WAITING_AGENT && conversation.waitingSince
      ? conversation.waitingSince
      : null;
  return {
    ...conversation,
    customer: serializeCustomer(conversation.customer),
    displayName: conversation.customer?.name || conversation.contactName || conversation.phone,
    waitingSince: conversation.waitingSince,
    waitingNow: Boolean(waiting),
    acceptedAt: conversation.acceptedAt,
    createdAt: conversation.createdAt,
    lastMessageAt: conversation.lastMessageAt,
    firstResponseAt: conversation.firstResponseAt,
    closedAt: conversation.closedAt,
    queueMs: conversation.acceptedAt
      ? new Date(conversation.acceptedAt).getTime() - new Date(conversation.queuedAt).getTime()
      : now.getTime() - new Date(conversation.queuedAt).getTime(),
    saleOrders: conversation.saleOrders || [],
  };
}

async function findCustomerByPhone(phone) {
  const variants = phoneMatchVariants(phone);
  const last8 = digitsOnly(phone).slice(-8);
  if (!last8 && !variants.length) return null;
  const phoneClauses = [
    ...(last8
      ? [
          { phone: { contains: last8 } },
          { phones: { some: { digits: { contains: last8 } } } },
          { phones: { some: { phone: { contains: last8 } } } },
        ]
      : []),
    ...variants.flatMap((value) => [
      { phone: { contains: value } },
      { phones: { some: { digits: { contains: value } } } },
      { phones: { some: { phone: { contains: value } } } },
    ]),
  ];
  return prisma.customer.findFirst({
    where: { OR: phoneClauses },
    orderBy: { updatedAt: "desc" },
  });
}

export async function listConversations(filters, session) {
  scheduleUnansweredAutomations();
  const teamIds = await getAgentTeamIds(session);
  if (!teamIds.length) {
    return paginationResult([], 0, parsePagination(filters));
  }

  const where = { teamId: { in: teamIds } };
  const status = String(filters.status || "").trim();
  if (status && Object.values(CONVERSATION_STATUSES).includes(status)) {
    where.status = status;
  } else if (filters.tab === "closed") {
    where.status = CONVERSATION_STATUSES.CLOSED;
  } else if (filters.tab === "waiting") {
    where.status = CONVERSATION_STATUSES.WAITING_AGENT;
  } else if (filters.tab === "replied") {
    where.status = CONVERSATION_STATUSES.AGENT_REPLIED;
  } else {
    where.status = { not: CONVERSATION_STATUSES.CLOSED };
  }

  const scope = String(filters.scope || "team");
  if (scope === "mine") where.agentId = session.id;
  if (scope === "unassigned") where.agentId = null;
  if (filters.teamId) {
    const teamId = parseId(filters.teamId);
    if (!teamIds.includes(teamId)) throw forbidden("Você não pertence a esta equipe.");
    where.teamId = teamId;
  }

  const text = String(filters.q || "").trim();
  if (text) {
    where.OR = [
      { phone: { contains: text } },
      { contactName: { contains: text } },
      { customer: { name: { contains: text } } },
      { lastMessagePreview: { contains: text } },
    ];
  }

  const pagination = parsePagination(filters);
  const [total, items] = await Promise.all([
    prisma.inboxConversation.count({ where }),
    prisma.inboxConversation.findMany({
      where,
      select: conversationListSelect,
      orderBy: [{ lastMessageAt: "desc" }, { createdAt: "desc" }],
      skip: pagination.skip,
      take: pagination.take,
    }),
  ]);
  return paginationResult(items.map(serializeConversation), total, pagination);
}

export async function getConversation(id, session, { markRead = false } = {}) {
  const conversation = await prisma.inboxConversation.findUnique({
    where: { id: Number(id) },
    select: {
      ...conversationListSelect,
      messages: { orderBy: { sentAt: "asc" }, take: 300, include: { user: userLite } },
      events: {
        where: { type: { not: CONVERSATION_EVENT_TYPES.NOTE } },
        orderBy: { createdAt: "asc" },
        take: 200,
        include: { user: userLite },
      },
    },
  });
  if (!conversation) throw notFound("Conversa não encontrada.");
  if (session && !session.system) {
    await assertInboxTeamAccess(session, conversation.teamId);
  }
  if (markRead && session && !session.system && conversation.unreadCount > 0) {
    await prisma.inboxConversation.update({
      where: { id: conversation.id },
      data: { unreadCount: 0 },
    });
    conversation.unreadCount = 0;
  }
  if (session && !session.system) {
    const { saleOrderAccessWhere } = await import("./sale-orders");
    conversation.saleOrders = await prisma.saleOrder.findMany({
      where: { conversationId: conversation.id, ...saleOrderAccessWhere(session) },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        number: true,
        status: true,
        createdAt: true,
        seller: { select: { id: true, name: true } },
      },
    });
  }
  return serializeConversation(conversation);
}

export async function linkConversationCustomer(id, customerId, session) {
  await getConversation(id, session, { markRead: false });
  const customer = await prisma.customer.findUnique({ where: { id: parseId(customerId) } });
  if (!customer) throw notFound("Cliente não encontrado.");
  const current = await prisma.inboxConversation.findUnique({
    where: { id: Number(id) },
    select: { id: true, customerId: true, phone: true },
  });
  if (current?.customerId && Number(current.customerId) !== customer.id) {
    throw conflict("Esta conversa já está vinculada a outro cliente.");
  }
  await prisma.inboxConversation.update({
    where: { id: Number(id) },
    data: { customerId: customer.id },
  });
  await addCustomerPhone(customer.id, current?.phone, { label: "WhatsApp" });
  await prisma.inboxConversationEvent.create({
    data: {
      conversationId: Number(id),
      type: CONVERSATION_EVENT_TYPES.CUSTOMER,
      message: `Cliente vinculado: ${customer.name}.`,
      userId: session.id,
    },
  });
  return getConversation(id, session, { markRead: false });
}

async function addEvent(tx, conversationId, type, message, userId) {
  return tx.inboxConversationEvent.create({
    data: { conversationId, type, message, userId: userId || null },
  });
}

function parseIncomingDate(timestamp) {
  if (!timestamp) return new Date();
  const numeric = Number(timestamp);
  if (Number.isFinite(numeric) && numeric > 0) {
    return new Date(numeric < 1e12 ? numeric * 1000 : numeric);
  }
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

async function findInboundConversation(tx, channelId, phone, jid) {
  if (jid) {
    const byJid = await tx.inboxConversation.findFirst({
      where: { channelId, whatsappJid: String(jid) },
    });
    if (byJid) return byJid;
  }
  const variants = phoneMatchVariants(phone);
  if (variants.length) {
    const byPhone = await tx.inboxConversation.findFirst({
      where: { channelId, phone: { in: variants } },
    });
    if (byPhone) return byPhone;
  }
  return null;
}

export async function ingestIncomingMessage({
  channel,
  from,
  pushName,
  body,
  externalId,
  timestamp,
  mediaUrl,
  mediaType,
  fileName,
  jid,
}) {
  const phone = normalizeWhatsAppPhone(from);
  const remoteJid = emptyToNull(jid);
  if (!phone && !remoteJid) throw validationError("Telefone de origem inválido.");
  if (externalId) {
    const existing = await prisma.inboxMessage.findUnique({ where: { externalId: String(externalId) } });
    if (existing) return getConversation(existing.conversationId, { system: true });
  }

  const now = parseIncomingDate(timestamp);
  const customer = phone ? await findCustomerByPhone(phone) : null;
  const preview = previewOf(body, mediaType, fileName);
  let created = false;
  let reopened = false;

  const conversationId = await prisma.$transaction(async (tx) => {
    let conversation = await findInboundConversation(tx, channel.id, phone, remoteJid);
    if (!conversation && !phone) {
      throw validationError("Não foi possível identificar o contato do WhatsApp.");
    }
    const wasClosed = conversation?.status === CONVERSATION_STATUSES.CLOSED;

    if (!conversation) {
      created = true;
      conversation = await tx.inboxConversation.create({
        data: {
          channelId: channel.id,
          teamId: channel.defaultTeamId,
          customerId: customer?.id || null,
          phone,
          whatsappJid: remoteJid,
          contactName: pushName || customer?.name || null,
          status: CONVERSATION_STATUSES.WAITING_AGENT,
          lastMessagePreview: preview,
          lastMessageDirection: MESSAGE_DIRECTIONS.IN,
          lastMessageAt: now,
          lastCustomerMessageAt: now,
          queuedAt: now,
          waitingSince: now,
          unreadCount: 1,
        },
      });
      await addEvent(tx, conversation.id, CONVERSATION_EVENT_TYPES.CREATED, "Conversa criada pelo WhatsApp.");
    } else {
      conversation = await tx.inboxConversation.update({
        where: { id: conversation.id },
        data: {
          contactName: conversation.contactName || pushName || customer?.name || conversation.contactName,
          customerId: conversation.customerId || customer?.id || null,
          whatsappJid: remoteJid || conversation.whatsappJid,
          status: CONVERSATION_STATUSES.WAITING_AGENT,
          lastMessagePreview: preview,
          lastMessageDirection: MESSAGE_DIRECTIONS.IN,
          lastMessageAt: now,
          lastCustomerMessageAt: now,
          waitingSince: now,
          unreadCount: { increment: 1 },
          ...(wasClosed
            ? {
                reopenedAt: now,
                closedAt: null,
                closedById: null,
                queuedAt: conversation.agentId ? conversation.queuedAt : now,
                greetingSentAt: null,
                afterHoursSentAt: null,
                unansweredNotifiedAt: null,
              }
            : {}),
        },
      });
      if (wasClosed) {
        reopened = true;
        await addEvent(tx, conversation.id, CONVERSATION_EVENT_TYPES.REOPENED, "Cliente enviou uma nova mensagem.");
      }
    }

    await tx.inboxMessage.create({
      data: {
        conversationId: conversation.id,
        direction: MESSAGE_DIRECTIONS.IN,
        body: emptyToNull(body),
        mediaUrl: emptyToNull(mediaUrl),
        mediaType: emptyToNull(mediaType),
        fileName: emptyToNull(fileName),
        externalId: emptyToNull(externalId),
        status: MESSAGE_STATUSES.DELIVERED,
        sentAt: now,
      },
    });
    return conversation.id;
  });

  const conversation = await getConversation(conversationId, { system: true });
  void applyInboundAutomations({
    channel,
    conversation,
    created,
    reopened,
  }).catch((error) => {
    console.error("[inbox-automation]", error.message || error);
  });
  return conversation;
}

export async function updateMessageStatus(externalId, status, timestamp) {
  if (!externalId) return null;
  const mapped =
    status === "READ" || status === "read"
      ? MESSAGE_STATUSES.READ
      : status === "DELIVERED" || status === "delivered"
        ? MESSAGE_STATUSES.DELIVERED
        : status === "FAILED" || status === "failed"
          ? MESSAGE_STATUSES.FAILED
          : status === "SENT" || status === "sent"
            ? MESSAGE_STATUSES.SENT
            : null;
  if (!mapped) return null;
  const message = await prisma.inboxMessage.findUnique({ where: { externalId: String(externalId) } });
  if (!message) return null;
  const at = parseIncomingDate(timestamp);
  return prisma.inboxMessage.update({
    where: { id: message.id },
    data: {
      status: mapped,
      deliveredAt: mapped === MESSAGE_STATUSES.DELIVERED || mapped === MESSAGE_STATUSES.READ ? message.deliveredAt || at : message.deliveredAt,
      readAt: mapped === MESSAGE_STATUSES.READ ? at : message.readAt,
    },
  });
}

export async function acceptConversation(id, session) {
  const conversation = await prisma.inboxConversation.findUnique({ where: { id: Number(id) } });
  if (!conversation) throw notFound("Conversa não encontrada.");
  await assertInboxTeamAccess(session, conversation.teamId);
  if (conversation.status === CONVERSATION_STATUSES.CLOSED) {
    throw conflict("Reabra a conversa antes de aceitar.");
  }
  if (conversation.agentId && conversation.agentId !== session.id && !isInboxAdmin(session)) {
    throw conflict("Esta conversa já está com outro agente.");
  }
  const now = new Date();
  const updated = await prisma.$transaction(async (tx) => {
    const next = await tx.inboxConversation.update({
      where: { id: conversation.id },
      data: {
        agentId: session.id,
        acceptedById: conversation.acceptedById && conversation.agentId === session.id ? conversation.acceptedById : session.id,
        acceptedAt: conversation.agentId === session.id && conversation.acceptedAt ? conversation.acceptedAt : now,
      },
    });
    if (!conversation.agentId || conversation.agentId !== session.id) {
      await addEvent(tx, conversation.id, CONVERSATION_EVENT_TYPES.ACCEPTED, `${session.name} entrou na conversa.`, session.id);
    }
    return next;
  });
  return getConversation(updated.id, session);
}

export async function transferConversation(id, payload, session) {
  const conversation = await prisma.inboxConversation.findUnique({ where: { id: Number(id) } });
  if (!conversation) throw notFound("Conversa não encontrada.");
  await assertInboxTeamAccess(session, conversation.teamId);
  if (!isInboxAdmin(session) && conversation.agentId && conversation.agentId !== session.id) {
    const member = await prisma.inboxTeamMember.findUnique({
      where: { teamId_userId: { teamId: conversation.teamId, userId: session.id } },
    });
    if (member?.role !== "SUPERVISOR") throw forbidden("Apenas o agente da conversa ou um supervisor pode transferir.");
  }

  const teamId = payload.teamId ? parseId(payload.teamId) : conversation.teamId;
  const team = await prisma.inboxTeam.findUnique({ where: { id: teamId } });
  if (!team || !team.active) throw validationError("Equipe de destino inválida.");

  let agentId = payload.agentId === null || payload.agentId === "" ? null : payload.agentId ? parseId(payload.agentId) : null;
  let agent = null;
  if (agentId) {
    const member = await prisma.inboxTeamMember.findUnique({
      where: { teamId_userId: { teamId, userId: agentId } },
      include: { user: { select: { id: true, name: true } } },
    });
    if (!member) throw validationError("O agente precisa pertencer à equipe de destino.");
    agent = member.user;
  }

  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.inboxConversation.update({
      where: { id: conversation.id },
      data: {
        teamId,
        agentId,
        acceptedById: agentId,
        acceptedAt: agentId ? now : null,
        queuedAt: agentId ? conversation.queuedAt : now,
        unansweredNotifiedAt: agentId ? conversation.unansweredNotifiedAt : null,
        status:
          conversation.status === CONVERSATION_STATUSES.CLOSED
            ? CONVERSATION_STATUSES.WAITING_AGENT
            : conversation.status,
      },
    });
    const target = agent
      ? `${session.name} transferiu para ${agent.name} (${team.name}).`
      : `${session.name} transferiu para a fila de ${team.name}.`;
    await addEvent(tx, conversation.id, CONVERSATION_EVENT_TYPES.TRANSFERRED, target, session.id);
  });
  return getConversation(conversation.id, session);
}

export async function closeConversation(id, session) {
  const conversation = await prisma.inboxConversation.findUnique({ where: { id: Number(id) } });
  if (!conversation) throw notFound("Conversa não encontrada.");
  await assertInboxTeamAccess(session, conversation.teamId);
  if (conversation.status === CONVERSATION_STATUSES.CLOSED) return getConversation(id, session);
  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.inboxConversation.update({
      where: { id: conversation.id },
      data: {
        status: CONVERSATION_STATUSES.CLOSED,
        closedAt: now,
        closedById: session.id,
        waitingSince: null,
        unreadCount: 0,
        unansweredNotifiedAt: null,
      },
    });
    await addEvent(tx, conversation.id, CONVERSATION_EVENT_TYPES.CLOSED, `${session.name} encerrou a conversa.`, session.id);
  });
  return getConversation(id, session);
}

export async function reopenConversation(id, session) {
  const conversation = await prisma.inboxConversation.findUnique({ where: { id: Number(id) } });
  if (!conversation) throw notFound("Conversa não encontrada.");
  await assertInboxTeamAccess(session, conversation.teamId);
  if (conversation.status !== CONVERSATION_STATUSES.CLOSED) return getConversation(id, session);
  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.inboxConversation.update({
      where: { id: conversation.id },
      data: {
        status: CONVERSATION_STATUSES.WAITING_AGENT,
        reopenedAt: now,
        closedAt: null,
        closedById: null,
        waitingSince: now,
        queuedAt: conversation.agentId ? conversation.queuedAt : now,
        greetingSentAt: null,
        afterHoursSentAt: null,
        unansweredNotifiedAt: null,
      },
    });
    await addEvent(tx, conversation.id, CONVERSATION_EVENT_TYPES.REOPENED, `${session.name} reabriu a conversa.`, session.id);
  });
  return getConversation(id, session);
}

async function sendViaChannel(channel, payload) {
  if (channel.provider === INBOX_PROVIDERS.DIALOG_360) {
    return sendDialog360Message(channel, payload);
  }
  if (channel.provider === INBOX_PROVIDERS.UNOFFICIAL) {
    return sendUnofficialMessage(channel, payload);
  }
  throw validationError("Provedor de canal não suportado.");
}

export async function sendConversationMessage(id, payload, session) {
  const conversation = await prisma.inboxConversation.findUnique({
    where: { id: Number(id) },
    include: { channel: true },
  });
  if (!conversation) throw notFound("Conversa não encontrada.");
  await assertInboxTeamAccess(session, conversation.teamId);

  const internal = Boolean(payload.internal);
  const body = String(payload.body || "").trim();
  const file = payload.file && typeof payload.file.arrayBuffer === "function" && payload.file.size > 0 ? payload.file : null;
  if (!body && !file) throw validationError("Escreva a mensagem ou anexe um arquivo.");
  if (internal && file) throw validationError("Notas internas não enviam arquivo. Use uma mensagem de texto.");

  if (internal) {
    const now = new Date();
    await prisma.$transaction(async (tx) => {
      await tx.inboxMessage.create({
        data: {
          conversationId: conversation.id,
          userId: session.id,
          direction: MESSAGE_DIRECTIONS.INTERNAL,
          body,
          status: MESSAGE_STATUSES.SENT,
          sentAt: now,
        },
      });
      await addEvent(tx, conversation.id, CONVERSATION_EVENT_TYPES.NOTE, body, session.id);
    });
    return getConversation(id, session);
  }

  if (conversation.status === CONVERSATION_STATUSES.CLOSED) {
    throw conflict("Reabra a conversa para responder.");
  }
  if (conversation.agentId !== session.id && !isInboxAdmin(session)) {
    throw forbidden("Aceite a conversa antes de responder.");
  }

  const channel = conversation.channel;
  if (!channel.active) throw validationError("Este canal está inativo.");

  const attachment = file ? await saveInboxAttachment(conversation.id, file) : null;
  const sent = await sendViaChannel(channel, {
    to: conversation.phone,
    jid: conversation.whatsappJid,
    body,
    media: attachment,
    templateName: emptyToNull(payload.templateName),
    templateLanguage: emptyToNull(payload.templateLanguage),
  });

  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.inboxMessage.create({
      data: {
        conversationId: conversation.id,
        userId: session.id,
        direction: MESSAGE_DIRECTIONS.OUT,
        body: emptyToNull(body),
        mediaUrl: attachment?.mediaUrl || null,
        mediaType: attachment?.mediaType || null,
        fileName: attachment?.fileName || null,
        externalId: sent.externalId,
        status: MESSAGE_STATUSES.SENT,
        sentAt: now,
      },
    });
    await tx.inboxConversation.update({
      where: { id: conversation.id },
      data: {
        status: CONVERSATION_STATUSES.AGENT_REPLIED,
        lastMessagePreview: previewOf(body, attachment?.mediaType, attachment?.fileName),
        lastMessageDirection: MESSAGE_DIRECTIONS.OUT,
        lastMessageAt: now,
        lastAgentMessageAt: now,
        firstResponseAt: conversation.firstResponseAt || now,
        waitingSince: null,
        agentId: conversation.agentId || session.id,
        acceptedById: conversation.acceptedById || session.id,
        acceptedAt: conversation.acceptedAt || now,
        whatsappJid: sent.jid || conversation.whatsappJid,
        afterHoursSentAt: null,
        unansweredNotifiedAt: null,
      },
    });
  });
  return getConversation(id, session);
}

export async function ingestOutgoingFromWorker({ channelId, to, body, externalId, timestamp }) {
  const channel = await getInboxChannelRecord(channelId);
  const phone = normalizeWhatsAppPhone(to);
  const conversation = await prisma.inboxConversation.findUnique({
    where: { channelId_phone: { channelId: channel.id, phone } },
  });
  if (!conversation) return null;
  if (externalId) {
    const exists = await prisma.inboxMessage.findUnique({ where: { externalId: String(externalId) } });
    if (exists) return null;
  }
  const now = parseIncomingDate(timestamp);
  await prisma.inboxMessage.create({
    data: {
      conversationId: conversation.id,
      direction: MESSAGE_DIRECTIONS.OUT,
      body: emptyToNull(body),
      externalId: emptyToNull(externalId),
      status: MESSAGE_STATUSES.SENT,
      sentAt: now,
    },
  });
  return conversation.id;
}

function assertChannelCanSend(channel) {
  if (!channel.active) throw validationError("Este canal está inativo.");
  if (channel.provider === INBOX_PROVIDERS.UNOFFICIAL && channel.connectionStatus !== INBOX_CONNECTION_STATUSES.CONNECTED) {
    throw validationError("Conecte o canal do WhatsApp antes de enviar.");
  }
  if (channel.provider === INBOX_PROVIDERS.DIALOG_360 && !channel.apiKey) {
    throw validationError("O canal oficial está sem API key.");
  }
}

export async function startOutboundConversation(payload, session) {
  const channel = await getInboxChannelRecord(parseId(payload.channelId));
  assertChannelCanSend(channel);
  await assertInboxTeamAccess(session, channel.defaultTeamId);

  let customer = null;
  if (payload.customerId) {
    customer = await prisma.customer.findUnique({ where: { id: parseId(payload.customerId) } });
    if (!customer) throw notFound("Cliente não encontrado.");
  }

  const phone = normalizeWhatsAppPhone(payload.phone || customer?.phone);
  if (!phone) throw validationError("Informe o telefone do cliente.");
  const body = String(payload.body || "").trim();
  if (!body) throw validationError("Escreva a mensagem.");
  const contactName = emptyToNull(payload.contactName) || customer?.name || null;

  const conversationId = await prisma.$transaction(async (tx) => {
    let conversation = await findInboundConversation(tx, channel.id, phone, null);
    const now = new Date();

    if (!conversation) {
      const linked = customer || (await findCustomerByPhone(phone));
      conversation = await tx.inboxConversation.create({
        data: {
          channelId: channel.id,
          teamId: channel.defaultTeamId,
          customerId: linked?.id || null,
          phone,
          contactName: contactName || linked?.name || null,
          status: CONVERSATION_STATUSES.WAITING_AGENT,
          agentId: session.id,
          acceptedById: session.id,
          acceptedAt: now,
          queuedAt: now,
          waitingSince: null,
          unreadCount: 0,
        },
      });
      await addEvent(tx, conversation.id, CONVERSATION_EVENT_TYPES.CREATED, `${session.name} iniciou a conversa.`, session.id);
      return conversation.id;
    }

    await assertInboxTeamAccess(session, conversation.teamId);
    if (conversation.agentId && conversation.agentId !== session.id && !isInboxAdmin(session)) {
      const member = await tx.inboxTeamMember.findUnique({
        where: { teamId_userId: { teamId: conversation.teamId, userId: session.id } },
      });
      if (member?.role !== "SUPERVISOR") {
        throw conflict("Já existe uma conversa com este número neste canal.");
      }
    }

    const wasClosed = conversation.status === CONVERSATION_STATUSES.CLOSED;
    await tx.inboxConversation.update({
      where: { id: conversation.id },
      data: {
        customerId: conversation.customerId || customer?.id || null,
        contactName: conversation.contactName || contactName,
        agentId: session.id,
        acceptedById: conversation.acceptedById || session.id,
        acceptedAt: conversation.acceptedAt || now,
        waitingSince: null,
        unreadCount: 0,
        ...(wasClosed
          ? {
              status: CONVERSATION_STATUSES.WAITING_AGENT,
              reopenedAt: now,
              closedAt: null,
              closedById: null,
            }
          : {}),
      },
    });
    if (wasClosed) {
      await addEvent(tx, conversation.id, CONVERSATION_EVENT_TYPES.REOPENED, `${session.name} reabriu a conversa para enviar uma mensagem.`, session.id);
    }
    return conversation.id;
  });

  if (customer) {
    await addCustomerPhone(customer.id, phone, { label: "WhatsApp" });
  }

  return sendConversationMessage(conversationId, { body }, session);
}
