import { prisma } from "../db";
import { conflict, notFound, validationError } from "../errors";
import { writeAudit } from "../audit";
import {
  GREETING_MODES,
  INBOX_CHANNEL_TYPES,
  INBOX_CONNECTION_STATUSES,
  INBOX_PROVIDERS,
} from "../constants";
import { emptyToNull, parseId } from "../validations";
import { normalizeWhatsAppPhone } from "../phone";
import { paginationResult, parsePagination } from "../pagination";
import { logoutUnofficial, requestUnofficialQr } from "../whatsapp/unofficial";
import { getAgentTeamIds } from "./inbox-access";
import { normalizeBusinessHours, normalizeTimezone } from "../inbox-hours";

const channelSelect = {
  id: true,
  name: true,
  type: true,
  provider: true,
  phoneNumber: true,
  externalId: true,
  connectionStatus: true,
  connectionError: true,
  qrPayload: true,
  defaultTeamId: true,
  active: true,
  businessHoursEnabled: true,
  timezone: true,
  businessHours: true,
  afterHoursReplyEnabled: true,
  afterHoursMessage: true,
  greetingEnabled: true,
  greetingMode: true,
  greetingMessage: true,
  unansweredEnabled: true,
  unansweredMinutes: true,
  unansweredMessage: true,
  createdAt: true,
  updatedAt: true,
  defaultTeam: { select: { id: true, name: true, color: true } },
  _count: { select: { conversations: true } },
};

function serializeChannel(channel, { includeSecrets = false, includeQr = false } = {}) {
  if (!channel) return null;
  return {
    id: channel.id,
    name: channel.name,
    type: channel.type,
    provider: channel.provider,
    phoneNumber: channel.phoneNumber,
    externalId: channel.externalId,
    connectionStatus: channel.connectionStatus,
    connectionError: channel.connectionError,
    qrPayload: includeQr ? channel.qrPayload : null,
    hasApiKey: Boolean(channel.apiKey || channel._hasApiKey),
    defaultTeamId: channel.defaultTeamId,
    defaultTeam: channel.defaultTeam,
    conversationCount: channel._count?.conversations ?? 0,
    active: channel.active,
    businessHoursEnabled: Boolean(channel.businessHoursEnabled),
    timezone: normalizeTimezone(channel.timezone),
    businessHours: normalizeBusinessHours(channel.businessHours),
    afterHoursReplyEnabled: Boolean(channel.afterHoursReplyEnabled),
    afterHoursMessage: channel.afterHoursMessage || "",
    greetingEnabled: Boolean(channel.greetingEnabled),
    greetingMode: channel.greetingMode || GREETING_MODES.FIRST_CONTACT,
    greetingMessage: channel.greetingMessage || "",
    unansweredEnabled: Boolean(channel.unansweredEnabled),
    unansweredMinutes: Number(channel.unansweredMinutes || 5),
    unansweredMessage: channel.unansweredMessage || "",
    createdAt: channel.createdAt,
    updatedAt: channel.updatedAt,
    webhookPath:
      channel.provider === INBOX_PROVIDERS.DIALOG_360
        ? `/api/integrations/whatsapp/360dialog/${channel.id}`
        : null,
    ...(includeSecrets ? { apiKey: channel.apiKey || null } : {}),
  };
}

function parseUnansweredMinutes(value) {
  const minutes = Number(value);
  if (!Number.isInteger(minutes) || minutes < 1 || minutes > 240) {
    throw validationError("O tempo sem resposta deve ser entre 1 e 240 minutos.");
  }
  return minutes;
}

function parseGreetingMode(value) {
  const mode = String(value || GREETING_MODES.FIRST_CONTACT);
  if (!Object.values(GREETING_MODES).includes(mode)) {
    throw validationError("Modo de saudação inválido.");
  }
  return mode;
}

function automationDataFrom(payload, { partial = false } = {}) {
  const data = {};
  const source = payload?.automation && typeof payload.automation === "object" ? { ...payload, ...payload.automation } : payload;

  if (!partial || source.businessHoursEnabled !== undefined) data.businessHoursEnabled = Boolean(source.businessHoursEnabled);
  if (!partial || source.timezone !== undefined) data.timezone = normalizeTimezone(source.timezone);
  if (!partial || source.businessHours !== undefined) data.businessHours = normalizeBusinessHours(source.businessHours);
  if (!partial || source.afterHoursReplyEnabled !== undefined) {
    data.afterHoursReplyEnabled = Boolean(source.afterHoursReplyEnabled);
  }
  if (!partial || source.afterHoursMessage !== undefined) {
    data.afterHoursMessage = emptyToNull(source.afterHoursMessage);
  }
  if (!partial || source.greetingEnabled !== undefined) data.greetingEnabled = Boolean(source.greetingEnabled);
  if (!partial || source.greetingMode !== undefined) data.greetingMode = parseGreetingMode(source.greetingMode);
  if (!partial || source.greetingMessage !== undefined) data.greetingMessage = emptyToNull(source.greetingMessage);
  if (!partial || source.unansweredEnabled !== undefined) data.unansweredEnabled = Boolean(source.unansweredEnabled);
  if (!partial || source.unansweredMinutes !== undefined) {
    data.unansweredMinutes = source.unansweredMinutes === undefined || source.unansweredMinutes === ""
      ? 5
      : parseUnansweredMinutes(source.unansweredMinutes);
  }
  if (!partial || source.unansweredMessage !== undefined) data.unansweredMessage = emptyToNull(source.unansweredMessage);

  if (data.greetingEnabled && !String(data.greetingMessage || source.greetingMessage || "").trim() && !partial) {
    throw validationError("Informe o texto da saudação automática.");
  }
  if (data.afterHoursReplyEnabled && !String(data.afterHoursMessage || source.afterHoursMessage || "").trim() && !partial) {
    throw validationError("Informe o texto da resposta fora do horário.");
  }
  if (data.unansweredEnabled && !String(data.unansweredMessage || source.unansweredMessage || "").trim() && !partial) {
    throw validationError("Informe o texto para quando nenhum agente responder.");
  }

  if (partial) {
    if (data.greetingEnabled && source.greetingMessage !== undefined && !data.greetingMessage) {
      throw validationError("Informe o texto da saudação automática.");
    }
    if (data.afterHoursReplyEnabled && source.afterHoursMessage !== undefined && !data.afterHoursMessage) {
      throw validationError("Informe o texto da resposta fora do horário.");
    }
    if (data.unansweredEnabled && source.unansweredMessage !== undefined && !data.unansweredMessage) {
      throw validationError("Informe o texto para quando nenhum agente responder.");
    }
  }

  return data;
}

export function publicAppUrl() {
  return String(process.env.APP_URL || "").replace(/\/$/, "");
}

export async function listInboxChannels({ q, page, pageSize, outbound, session } = {}) {
  const where = {};
  const text = String(q || "").trim();
  if (text) {
    where.OR = [
      { name: { contains: text } },
      { phoneNumber: { contains: text } },
    ];
  }
  if (outbound) {
    const teamIds = await getAgentTeamIds(session);
    where.active = true;
    where.defaultTeamId = { in: teamIds.length ? teamIds : [-1] };
  }
  const pagination = parsePagination({ page, pageSize }, { defaultAll: true });
  const [total, items] = await Promise.all([
    prisma.inboxChannel.count({ where }),
    prisma.inboxChannel.findMany({
      where,
      select: { ...channelSelect, apiKey: true },
      orderBy: { name: "asc" },
      skip: pagination.skip,
      take: pagination.take,
    }),
  ]);
  return paginationResult(items.map((item) => serializeChannel(item)), total, pagination);
}

export async function getInboxChannel(id, options = {}) {
  const channel = await prisma.inboxChannel.findUnique({
    where: { id: Number(id) },
    select: { ...channelSelect, apiKey: true },
  });
  if (!channel) throw notFound("Canal não encontrado.");
  return serializeChannel(channel, options);
}

export async function getInboxChannelRecord(id) {
  const channel = await prisma.inboxChannel.findUnique({ where: { id: Number(id) } });
  if (!channel) throw notFound("Canal não encontrado.");
  return channel;
}

async function assertTeam(teamId) {
  const team = await prisma.inboxTeam.findUnique({ where: { id: Number(teamId) } });
  if (!team) throw validationError("Equipe padrão inválida.");
  if (!team.active) throw validationError("A equipe padrão está inativa.");
  return team;
}

export async function createInboxChannel(payload, actor) {
  const name = String(payload.name || "").trim();
  if (!name) throw validationError("Informe o nome do canal.");
  const type = payload.type || INBOX_CHANNEL_TYPES.WHATSAPP;
  if (!Object.values(INBOX_CHANNEL_TYPES).includes(type)) throw validationError("Tipo de canal inválido.");
  const provider = String(payload.provider || "").trim();
  if (!Object.values(INBOX_PROVIDERS).includes(provider)) {
    throw validationError("Informe o provedor: 360dialog ou WhatsApp não oficial.");
  }
  const defaultTeamId = parseId(payload.defaultTeamId);
  await assertTeam(defaultTeamId);

  const exists = await prisma.inboxChannel.findFirst({ where: { name } });
  if (exists) throw conflict("Já existe um canal com este nome.");

  const channel = await prisma.inboxChannel.create({
    data: {
      name,
      type,
      provider,
      phoneNumber: normalizeWhatsAppPhone(payload.phoneNumber) || emptyToNull(payload.phoneNumber),
      externalId: emptyToNull(payload.externalId),
      apiKey: emptyToNull(payload.apiKey),
      defaultTeamId,
      connectionStatus:
        provider === INBOX_PROVIDERS.DIALOG_360 && payload.apiKey
          ? INBOX_CONNECTION_STATUSES.CONNECTED
          : INBOX_CONNECTION_STATUSES.DISCONNECTED,
      ...automationDataFrom(payload),
    },
    select: { ...channelSelect, apiKey: true },
  });

  await writeAudit({
    userId: actor.id,
    action: "INBOX_CHANNEL_CREATED",
    entity: "inbox_channel",
    entityId: channel.id,
    newData: serializeChannel(channel),
  });
  return serializeChannel(channel);
}

export async function updateInboxChannel(id, payload, actor) {
  const current = await prisma.inboxChannel.findUnique({ where: { id: Number(id) } });
  if (!current) throw notFound("Canal não encontrado.");

  const data = {};
  if (payload.name !== undefined) {
    data.name = String(payload.name || "").trim();
    if (!data.name) throw validationError("Informe o nome do canal.");
    const exists = await prisma.inboxChannel.findFirst({ where: { name: data.name } });
    if (exists && exists.id !== current.id) throw conflict("Já existe um canal com este nome.");
  }
  if (payload.phoneNumber !== undefined) {
    data.phoneNumber = normalizeWhatsAppPhone(payload.phoneNumber) || emptyToNull(payload.phoneNumber);
  }
  if (payload.externalId !== undefined) data.externalId = emptyToNull(payload.externalId);
  if (payload.apiKey !== undefined && payload.apiKey !== "") data.apiKey = emptyToNull(payload.apiKey);
  if (payload.defaultTeamId !== undefined) {
    data.defaultTeamId = parseId(payload.defaultTeamId);
    await assertTeam(data.defaultTeamId);
  }
  if (payload.active !== undefined) data.active = Boolean(payload.active);
  Object.assign(data, automationDataFrom(payload, { partial: true }));

  const channel = await prisma.inboxChannel.update({
    where: { id: current.id },
    data,
    select: { ...channelSelect, apiKey: true },
  });
  await writeAudit({
    userId: actor.id,
    action: "INBOX_CHANNEL_UPDATED",
    entity: "inbox_channel",
    entityId: channel.id,
    oldData: { name: current.name, active: current.active },
    newData: serializeChannel(channel),
  });
  return serializeChannel(channel);
}

export async function connectInboxChannel(id) {
  const channel = await getInboxChannelRecord(id);
  if (channel.provider !== INBOX_PROVIDERS.UNOFFICIAL) {
    throw validationError("Só o canal não oficial usa QR Code.");
  }
  await prisma.inboxChannel.update({
    where: { id: channel.id },
    data: {
      connectionStatus: INBOX_CONNECTION_STATUSES.QR_PENDING,
      connectionError: null,
      qrPayload: null,
    },
  });
  try {
    await requestUnofficialQr(channel.id);
  } catch (error) {
    await prisma.inboxChannel.update({
      where: { id: channel.id },
      data: {
        connectionStatus: INBOX_CONNECTION_STATUSES.ERROR,
        connectionError: error.message,
      },
    });
    throw error;
  }
  return getInboxChannel(channel.id, { includeQr: true });
}

export async function disconnectInboxChannel(id) {
  const channel = await getInboxChannelRecord(id);
  if (channel.provider === INBOX_PROVIDERS.UNOFFICIAL) {
    try {
      await logoutUnofficial(channel.id);
    } catch {
      // still mark disconnected locally
    }
  }
  const updated = await prisma.inboxChannel.update({
    where: { id: channel.id },
    data: {
      connectionStatus: INBOX_CONNECTION_STATUSES.DISCONNECTED,
      qrPayload: null,
      connectionError: null,
    },
    select: { ...channelSelect, apiKey: true },
  });
  return serializeChannel(updated);
}

export async function updateChannelConnection(id, payload) {
  const channel = await prisma.inboxChannel.findUnique({ where: { id: Number(id) } });
  if (!channel) throw notFound("Canal não encontrado.");
  const data = {};
  if (payload.connectionStatus) data.connectionStatus = payload.connectionStatus;
  if (payload.connectionError !== undefined) data.connectionError = emptyToNull(payload.connectionError);
  if (payload.qrPayload !== undefined) data.qrPayload = payload.qrPayload || null;
  if (payload.phoneNumber !== undefined) {
    data.phoneNumber = normalizeWhatsAppPhone(payload.phoneNumber) || emptyToNull(payload.phoneNumber);
  }
  if (payload.externalId !== undefined) data.externalId = emptyToNull(payload.externalId);
  const updated = await prisma.inboxChannel.update({
    where: { id: channel.id },
    data,
    select: { ...channelSelect, apiKey: true },
  });
  return serializeChannel(updated, { includeQr: true });
}

export async function findChannelForDialog360({ channelId, phoneNumberId, displayPhone }) {
  if (channelId) {
    const channel = await prisma.inboxChannel.findFirst({
      where: { id: Number(channelId), provider: INBOX_PROVIDERS.DIALOG_360, active: true },
    });
    if (channel) return channel;
  }
  if (phoneNumberId) {
    const byExternal = await prisma.inboxChannel.findFirst({
      where: { provider: INBOX_PROVIDERS.DIALOG_360, active: true, externalId: String(phoneNumberId) },
    });
    if (byExternal) return byExternal;
  }
  const phone = normalizeWhatsAppPhone(displayPhone);
  if (phone) {
    const byPhone = await prisma.inboxChannel.findFirst({
      where: { provider: INBOX_PROVIDERS.DIALOG_360, active: true, phoneNumber: phone },
    });
    if (byPhone) return byPhone;
  }
  return null;
}

export async function listUnofficialChannels() {
  return prisma.inboxChannel.findMany({
    where: { provider: INBOX_PROVIDERS.UNOFFICIAL, active: true },
    select: {
      id: true,
      name: true,
      phoneNumber: true,
      connectionStatus: true,
    },
  });
}
