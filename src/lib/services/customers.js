import { prisma } from "../db";
import { notFound, validationError } from "../errors";
import { writeAudit } from "../audit";
import { emptyToNull } from "../validations";

const customerSelect = {
  id: true,
  name: true,
  phone: true,
  document: true,
  email: true,
  address: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
  createdBy: { select: { id: true, name: true } },
};

export function serializeCustomer(customer) {
  if (!customer) return null;
  return customer;
}

function validateCustomerPayload(payload, { partial = false } = {}) {
  const data = {};
  if (!partial || payload.name !== undefined) {
    data.name = String(payload.name || "").trim();
    if (!partial && !data.name) throw validationError("Informe o nome do cliente.");
  }
  if (!partial || payload.phone !== undefined) {
    data.phone = String(payload.phone || "").trim();
    if (!partial && !data.phone) throw validationError("Informe o telefone do cliente.");
  }
  if (!partial || payload.document !== undefined) {
    data.document = emptyToNull(payload.document);
  }
  if (!partial || payload.email !== undefined) {
    data.email = emptyToNull(payload.email);
    if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
      throw validationError("E-mail inválido.");
    }
  }
  if (!partial || payload.address !== undefined) {
    data.address = emptyToNull(payload.address);
    if (!partial && !data.address) throw validationError("Informe o endereço do cliente.");
  }
  if (!partial || payload.notes !== undefined) {
    data.notes = emptyToNull(payload.notes);
  }
  return data;
}

export async function listCustomers({ q, page = 1, pageSize = 40 } = {}) {
  const where = {};
  const text = String(q || "").trim();
  if (text) {
    where.OR = [
      { name: { contains: text } },
      { phone: { contains: text } },
      { document: { contains: text } },
      { email: { contains: text } },
      { address: { contains: text } },
    ];
  }

  const take = Math.min(Number(pageSize) || 40, 100);
  const skip = (Math.max(Number(page) || 1, 1) - 1) * take;

  const [total, items] = await Promise.all([
    prisma.customer.count({ where }),
    prisma.customer.findMany({
      where,
      select: customerSelect,
      orderBy: { name: "asc" },
      skip,
      take,
    }),
  ]);

  return { items, total, page: Math.max(Number(page) || 1, 1), pageSize: take };
}

export async function getCustomer(id) {
  const customer = await prisma.customer.findUnique({
    where: { id: Number(id) },
    select: {
      ...customerSelect,
      sales: {
        orderBy: { soldAt: "desc" },
        take: 20,
        include: {
          product: {
            select: {
              id: true,
              serialOnyx: true,
              status: true,
              catalogModel: { select: { commercialName: true } },
            },
          },
          unit: { select: { id: true, name: true, type: true } },
        },
      },
    },
  });
  if (!customer) throw notFound("Cliente não encontrado.");
  return customer;
}

export async function createCustomer(payload, actor) {
  const data = validateCustomerPayload(payload);
  const customer = await prisma.customer.create({
    data: { ...data, createdById: actor.id },
    select: customerSelect,
  });
  await writeAudit({
    userId: actor.id,
    action: "CUSTOMER_CREATED",
    entity: "customer",
    entityId: customer.id,
    newData: customer,
  });
  return customer;
}

export async function updateCustomer(id, payload, actor) {
  const current = await prisma.customer.findUnique({ where: { id: Number(id) } });
  if (!current) throw notFound("Cliente não encontrado.");
  const data = validateCustomerPayload(payload, { partial: true });
  const customer = await prisma.customer.update({
    where: { id: current.id },
    data,
    select: customerSelect,
  });
  await writeAudit({
    userId: actor.id,
    action: "CUSTOMER_UPDATED",
    entity: "customer",
    entityId: customer.id,
    oldData: current,
    newData: customer,
  });
  return customer;
}
