import { prisma } from "./db";

export async function writeAudit({ userId, action, entity, entityId, oldData, newData }) {
  await prisma.auditLog.create({
    data: {
      userId,
      action,
      entity,
      entityId: Number(entityId),
      oldData: oldData ? JSON.stringify(oldData) : null,
      newData: newData ? JSON.stringify(newData) : null,
    },
  });
}

export async function writeMovement({
  productId,
  type,
  reason,
  previousStatus,
  newStatus,
  observation,
  origin,
  userId,
}) {
  return prisma.stockMovement.create({
    data: {
      productId,
      type,
      reason: reason || null,
      previousStatus: previousStatus || null,
      newStatus: newStatus || null,
      observation: observation || null,
      origin: origin || null,
      userId,
    },
    include: {
      user: { select: { id: true, name: true, email: true } },
    },
  });
}
