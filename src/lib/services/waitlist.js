import { prisma } from "../db";
import { validationError } from "../errors";
import {
  CONDITIONS,
  CONVERSATION_EVENT_TYPES,
  LEAD_STAGES,
  STATUSES,
  VOLTAGES,
} from "../constants";
import { emptyToNull, parseId } from "../validations";

const WAITLIST_CLEAR = {
  waitlistCommercialName: null,
  waitlistModelCode: null,
  waitlistCapacity: null,
  waitlistVoltage: null,
  waitlistCondition: null,
  waitlistCategoryId: null,
  waitlistLineId: null,
};

function normalize(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function textMatches(haystack, needle) {
  const wanted = normalize(needle);
  if (!wanted) return true;
  return normalize(haystack).includes(wanted);
}

export function waitlistCriteriaFromPayload(payload = {}) {
  const commercialName = emptyToNull(payload.commercialName ?? payload.waitlistCommercialName);
  const modelCode = emptyToNull(payload.modelCode ?? payload.waitlistModelCode);
  const capacity = emptyToNull(payload.capacity ?? payload.waitlistCapacity);
  const voltage = emptyToNull(payload.voltage ?? payload.waitlistVoltage);
  const condition = emptyToNull(payload.condition ?? payload.waitlistCondition);
  const categoryRaw = payload.categoryId ?? payload.waitlistCategoryId;
  const lineRaw = payload.lineId ?? payload.waitlistLineId;
  const categoryId = categoryRaw != null && String(categoryRaw).trim() !== "" ? parseId(categoryRaw) : null;
  const lineId = lineRaw != null && String(lineRaw).trim() !== "" ? parseId(lineRaw) : null;

  if (!commercialName && !modelCode) {
    throw validationError("Informe o nome comercial ou o Model Code da lista de espera.");
  }
  if (voltage && !Object.values(VOLTAGES).includes(voltage)) {
    throw validationError("Voltagem inválida.");
  }
  if (condition && !Object.values(CONDITIONS).includes(condition)) {
    throw validationError("Condição inválida.");
  }
  return {
    waitlistCommercialName: commercialName,
    waitlistModelCode: modelCode,
    waitlistCapacity: capacity,
    waitlistVoltage: voltage,
    waitlistCondition: condition,
    waitlistCategoryId: categoryId,
    waitlistLineId: lineId,
  };
}

export async function saveConversationWaitlist(db, conversationId, criteria) {
  await db.inboxConversation.update({
    where: { id: Number(conversationId) },
    data: criteria,
  });
}

export async function clearConversationWaitlist(db, conversationId) {
  const id = Number(conversationId);
  await db.inboxWaitlistMatch.deleteMany({ where: { conversationId: id } });
  await db.inboxConversation.update({
    where: { id },
    data: WAITLIST_CLEAR,
  });
}

export async function releaseWaitlistProduct(conversationId, productId) {
  if (!conversationId || !productId) return;
  await prisma.inboxWaitlistMatch.deleteMany({
    where: { conversationId: Number(conversationId), productId: Number(productId) },
  });
}

function matchesWaitlist(wait, product) {
  if (wait.waitlistCommercialName && !textMatches(product.catalogModel?.commercialName, wait.waitlistCommercialName)) return false;
  if (wait.waitlistModelCode && !textMatches(product.supplierModelCode, wait.waitlistModelCode)) return false;
  if (wait.waitlistCapacity && !textMatches(product.capacitySizeType, wait.waitlistCapacity)) return false;
  if (wait.waitlistVoltage && product.voltage !== wait.waitlistVoltage) return false;
  if (wait.waitlistCondition && product.condition !== wait.waitlistCondition) return false;
  if (wait.waitlistCategoryId && product.categoryId !== wait.waitlistCategoryId) return false;
  if (wait.waitlistLineId && product.lineId !== wait.waitlistLineId) return false;
  return Boolean(
    wait.waitlistCommercialName
    || wait.waitlistModelCode
    || wait.waitlistCapacity
    || wait.waitlistVoltage
    || wait.waitlistCondition
    || wait.waitlistCategoryId
    || wait.waitlistLineId,
  );
}

export async function rematchConversation(conversationId) {
  const id = Number(conversationId);
  const conversation = await prisma.inboxConversation.findUnique({ where: { id } });
  if (!conversation || conversation.commercialStage !== LEAD_STAGES.WAITLIST) return;
  const where = { status: STATUSES.AVAILABLE, deletedAt: null };
  if (conversation.waitlistCommercialName) {
    where.catalogModel = { commercialName: { contains: conversation.waitlistCommercialName } };
  }
  if (conversation.waitlistModelCode) where.supplierModelCode = { contains: conversation.waitlistModelCode };
  if (conversation.waitlistCapacity) where.capacitySizeType = { contains: conversation.waitlistCapacity };
  if (conversation.waitlistVoltage) where.voltage = conversation.waitlistVoltage;
  if (conversation.waitlistCondition) where.condition = conversation.waitlistCondition;
  if (conversation.waitlistCategoryId) where.categoryId = conversation.waitlistCategoryId;
  if (conversation.waitlistLineId) where.lineId = conversation.waitlistLineId;

  const products = await prisma.product.findMany({
    where,
    include: { catalogModel: { select: { commercialName: true } } },
    take: 30,
  });
  const matched = products.filter((product) => matchesWaitlist(conversation, product));
  const ids = matched.map((product) => product.id);
  await prisma.inboxWaitlistMatch.deleteMany({
    where: {
      conversationId: id,
      ...(ids.length ? { productId: { notIn: ids } } : {}),
    },
  });
  for (const product of matched) {
    await rememberWaitlistMatch(conversation.id, product);
  }
}

async function rememberWaitlistMatch(conversationId, product) {
  const existing = await prisma.inboxWaitlistMatch.findUnique({
    where: { conversationId_productId: { conversationId, productId: product.id } },
  });
  if (existing) return;
  await prisma.inboxWaitlistMatch.create({
    data: { conversationId, productId: product.id },
  });
  const label = product.catalogModel?.commercialName || product.supplierModelCode || "produto";
  await prisma.inboxConversationEvent.create({
    data: {
      conversationId,
      type: CONVERSATION_EVENT_TYPES.STAGE,
      message: `Chegou ${product.serialOnyx} · ${label}. O aparelho atende a lista de espera.`,
    },
  });
}

export async function syncProductWaitlist(productId) {
  const id = Number(productId);
  if (!id) return;
  try {
    const product = await prisma.product.findUnique({
      where: { id },
      include: { catalogModel: { select: { commercialName: true } } },
    });
    if (!product || product.deletedAt || product.status !== STATUSES.AVAILABLE) {
      await prisma.inboxWaitlistMatch.deleteMany({ where: { productId: id } });
      return;
    }

    const waiting = await prisma.inboxConversation.findMany({
      where: { commercialStage: LEAD_STAGES.WAITLIST },
    });
    const matched = waiting.filter((conversation) => matchesWaitlist(conversation, product));
    const matchedIds = matched.map((conversation) => conversation.id);
    await prisma.inboxWaitlistMatch.deleteMany({
      where: {
        productId: id,
        ...(matchedIds.length ? { conversationId: { notIn: matchedIds } } : {}),
      },
    });

    for (const conversation of matched) {
      await rememberWaitlistMatch(conversation.id, product);
    }
  } catch (error) {
    console.error("[waitlist]", error);
  }
}
