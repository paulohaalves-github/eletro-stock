import { prisma } from "../db";
import {
  CONVERSATION_EVENT_TYPES,
  CONVERSATION_STATUSES,
  GREETING_MODES,
  INBOX_CONNECTION_STATUSES,
  INBOX_PROVIDERS,
  MESSAGE_DIRECTIONS,
  MESSAGE_STATUSES,
} from "../constants";
import { isWithinBusinessHours } from "../inbox-hours";
import { sendDialog360Message } from "../whatsapp/dialog360";
import { sendUnofficialMessage } from "../whatsapp/unofficial";

const UNANSWERED_INTERVAL_MS = 60_000;
let unansweredTimer = null;
let lastUnansweredRun = 0;

async function sendViaChannel(channel, payload) {
  if (channel.provider === INBOX_PROVIDERS.DIALOG_360) {
    return sendDialog360Message(channel, payload);
  }
  if (channel.provider === INBOX_PROVIDERS.UNOFFICIAL) {
    return sendUnofficialMessage(channel, payload);
  }
  throw new Error("Provedor de canal não suportado.");
}

function channelCanSend(channel) {
  if (!channel?.active) return false;
  if (channel.provider === INBOX_PROVIDERS.UNOFFICIAL) {
    return channel.connectionStatus === INBOX_CONNECTION_STATUSES.CONNECTED;
  }
  if (channel.provider === INBOX_PROVIDERS.DIALOG_360) {
    return Boolean(channel.apiKey);
  }
  return false;
}

async function sendAutomationMessage({ channel, conversation, body, eventMessage, flagField }) {
  const text = String(body || "").trim();
  if (!text || !channelCanSend(channel) || !conversation?.id) return false;

  const now = new Date();
  const claimed = await prisma.inboxConversation.updateMany({
    where: { id: conversation.id, [flagField]: null },
    data: { [flagField]: now },
  });
  if (claimed.count !== 1) return false;

  try {
    const sent = await sendViaChannel(channel, {
      to: conversation.phone,
      jid: conversation.whatsappJid,
      body: text,
    });
    await prisma.$transaction([
      prisma.inboxMessage.create({
        data: {
          conversationId: conversation.id,
          direction: MESSAGE_DIRECTIONS.OUT,
          body: text,
          externalId: sent.externalId || null,
          status: MESSAGE_STATUSES.SENT,
          sentAt: now,
        },
      }),
      prisma.inboxConversationEvent.create({
        data: {
          conversationId: conversation.id,
          type: CONVERSATION_EVENT_TYPES.AUTOMATION,
          message: eventMessage,
        },
      }),
    ]);
    return true;
  } catch (error) {
    await prisma.inboxConversation.update({
      where: { id: conversation.id },
      data: { [flagField]: null },
    }).catch(() => {});
    console.error("[inbox-automation]", error.message || error);
    return false;
  }
}

function shouldSendGreeting(channel, { created, reopened }) {
  if (!channel.greetingEnabled || !String(channel.greetingMessage || "").trim()) return false;
  if (channel.greetingMode === GREETING_MODES.EVERY_NEW_CONVERSATION) return Boolean(created || reopened);
  return Boolean(created);
}

export async function applyInboundAutomations({ channel, conversation, created, reopened }) {
  if (!channel || !conversation) return { sent: [] };
  const sent = [];
  const open = isWithinBusinessHours(channel);

  if (!open && channel.afterHoursReplyEnabled && String(channel.afterHoursMessage || "").trim()) {
    const ok = await sendAutomationMessage({
      channel,
      conversation,
      body: channel.afterHoursMessage,
      eventMessage: "Resposta automática fora do horário de atendimento.",
      flagField: "afterHoursSentAt",
    });
    if (ok) sent.push("afterHours");
    return { sent };
  }

  if (open && shouldSendGreeting(channel, { created, reopened })) {
    const ok = await sendAutomationMessage({
      channel,
      conversation,
      body: channel.greetingMessage,
      eventMessage:
        channel.greetingMode === GREETING_MODES.EVERY_NEW_CONVERSATION
          ? "Saudação automática enviada nesta conversa."
          : "Saudação automática enviada no primeiro contato.",
      flagField: "greetingSentAt",
    });
    if (ok) sent.push("greeting");
  }

  return { sent };
}

export async function processUnansweredAutomations() {
  const channels = await prisma.inboxChannel.findMany({
    where: { active: true, unansweredEnabled: true },
  });
  let scanned = 0;
  let sent = 0;

  for (const channel of channels) {
    const minutes = Number(channel.unansweredMinutes || 0);
    const text = String(channel.unansweredMessage || "").trim();
    if (minutes < 1 || !text || !channelCanSend(channel)) continue;
    if (channel.businessHoursEnabled && !isWithinBusinessHours(channel)) continue;

    const cutoff = new Date(Date.now() - minutes * 60 * 1000);
    const conversations = await prisma.inboxConversation.findMany({
      where: {
        channelId: channel.id,
        status: CONVERSATION_STATUSES.WAITING_AGENT,
        agentId: null,
        unansweredNotifiedAt: null,
        waitingSince: { lte: cutoff },
      },
      select: {
        id: true,
        phone: true,
        whatsappJid: true,
      },
      take: 50,
    });
    scanned += conversations.length;
    for (const conversation of conversations) {
      const ok = await sendAutomationMessage({
        channel,
        conversation,
        body: text,
        eventMessage: `Aviso automático: nenhum agente respondeu em ${minutes} min.`,
        flagField: "unansweredNotifiedAt",
      });
      if (ok) sent += 1;
    }
  }

  return { scanned, sent };
}

export function scheduleUnansweredAutomations() {
  const now = Date.now();
  if (now - lastUnansweredRun < UNANSWERED_INTERVAL_MS) return;
  lastUnansweredRun = now;
  void processUnansweredAutomations().catch((error) => {
    console.error("[inbox-automation]", error.message || error);
  });
}

export function startInboxAutomationScheduler() {
  if (globalThis.__inboxAutomationTimer) return;
  const tick = () => {
    lastUnansweredRun = 0;
    scheduleUnansweredAutomations();
  };
  unansweredTimer = setInterval(tick, UNANSWERED_INTERVAL_MS);
  globalThis.__inboxAutomationTimer = unansweredTimer;
  if (typeof unansweredTimer.unref === "function") unansweredTimer.unref();
  setTimeout(tick, 15_000);
}
