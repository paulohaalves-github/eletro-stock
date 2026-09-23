import { prisma } from "../db";
import { notFound, validationError } from "../errors";
import { writeAudit } from "../audit";
import { SALE_ORDER_CLOSED_STATUSES, WORK_ORDER_CLOSED_STATUSES } from "../constants";
import { emptyToNull } from "../validations";
import { paginationResult, parsePagination } from "../pagination";
import { digitsOnly, formatPhone, normalizeWhatsAppPhone, phoneMatchVariants } from "../phone";
import { serializeSale } from "./sales";
import { saleOrderAccessWhere } from "./sale-orders";

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
  phones: { orderBy: [{ primary: "desc" }, { createdAt: "asc" }] },
};

export function serializeCustomer(customer) {
  if (!customer) return null;
  const phones = (customer.phones || []).map((item) => ({
    id: item.id,
    phone: item.phone,
    digits: item.digits,
    label: item.label || null,
    primary: Boolean(item.primary),
    display: formatPhone(item.phone),
  }));
  const primary =
    phones.find((item) => item.primary) ||
    phones.find((item) => digitsOnly(item.phone).slice(-8) === digitsOnly(customer.phone).slice(-8)) ||
    null;
  const displays = phones.map((item) => item.display).filter(Boolean);
  if (customer.phone && !customerHasPhone({ phones, phone: "" }, customer.phone)) {
    displays.unshift(formatPhone(customer.phone));
  }
  return {
    ...customer,
    phones,
    phone: primary?.phone || customer.phone || phones[0]?.phone || "",
    phoneLabel: displays.join(" · ") || formatPhone(customer.phone),
  };
}

function parsePhoneEntries(payload) {
  const raw = Array.isArray(payload.phones)
    ? payload.phones
    : payload.phone !== undefined
      ? [{ phone: payload.phone, label: payload.phoneLabel || null, primary: true }]
      : null;
  if (!raw) return null;
  const seen = new Set();
  const phones = [];
  for (const entry of raw) {
    const phone = String(entry?.phone || entry || "").trim();
    if (!phone) continue;
    const digits = digitsOnly(phone);
    if (digits.length < 8) throw validationError("Informe um telefone válido, com DDD.");
    const key = digits.slice(-8);
    if (seen.has(key)) continue;
    seen.add(key);
    phones.push({
      phone,
      digits: normalizeWhatsAppPhone(phone) || digits,
      label: emptyToNull(entry?.label),
      primary: phones.length === 0,
    });
  }
  return phones;
}

function validateCustomerPayload(payload, { partial = false } = {}) {
  const data = {};
  if (!partial || payload.name !== undefined) {
    data.name = String(payload.name || "").trim();
    if (!partial && !data.name) throw validationError("Informe o nome do cliente.");
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

function phoneSearchWhere(text) {
  const digits = digitsOnly(text);
  const or = [
    { phone: { contains: text } },
    { phones: { some: { phone: { contains: text } } } },
  ];
  if (digits) {
    or.push({ phones: { some: { digits: { contains: digits } } } });
  }
  return or;
}

export function customerHasPhone(customer, phone) {
  const variants = new Set([
    ...phoneMatchVariants(phone),
    digitsOnly(phone),
    digitsOnly(phone).slice(-8),
  ].filter(Boolean));
  const values = [
    customer?.phone,
    ...(customer?.phones || []).flatMap((item) => [item.phone, item.digits]),
  ];
  return values.some((value) => {
    const digits = digitsOnly(value);
    return digits && [...variants].some((variant) => digits.endsWith(variant.slice(-8)) || variant.endsWith(digits.slice(-8)));
  });
}

async function replaceCustomerPhones(customerId, phones) {
  await prisma.customerPhone.deleteMany({ where: { customerId } });
  if (!phones.length) return;
  await prisma.customerPhone.createMany({
    data: phones.map((item) => ({
      customerId,
      phone: item.phone,
      digits: item.digits,
      label: item.label,
      primary: item.primary,
    })),
  });
  await prisma.customer.update({
    where: { id: customerId },
    data: { phone: phones[0].phone },
  });
}

export async function addCustomerPhone(customerId, phone, { label } = {}) {
  const value = String(phone || "").trim();
  if (!value) return serializeCustomer(await prisma.customer.findUnique({ where: { id: customerId }, select: customerSelect }));
  const digits = normalizeWhatsAppPhone(value) || digitsOnly(value);
  if (digits.length < 8) return serializeCustomer(await prisma.customer.findUnique({ where: { id: customerId }, select: customerSelect }));

  const customer = await prisma.customer.findUnique({
    where: { id: Number(customerId) },
    select: customerSelect,
  });
  if (!customer) throw notFound("Cliente não encontrado.");
  if (customerHasPhone(customer, value)) {
    return serializeCustomer(customer);
  }

  const hasExisting = Boolean((customer.phones || []).length || customer.phone);
  try {
    await prisma.customerPhone.create({
      data: {
        customerId: customer.id,
        phone: value,
        digits,
        label: emptyToNull(label),
        primary: !hasExisting,
      },
    });
  } catch (error) {
    if (error?.code !== "P2002") throw error;
  }
  if (!customer.phone) {
    await prisma.customer.update({ where: { id: customer.id }, data: { phone: value } });
  }
  return serializeCustomer(await prisma.customer.findUnique({ where: { id: customer.id }, select: customerSelect }));
}

export async function listCustomers({ q, page = 1, pageSize } = {}) {
  const where = {};
  const text = String(q || "").trim();
  if (text) {
    where.OR = [
      { name: { contains: text } },
      { document: { contains: text } },
      { email: { contains: text } },
      { address: { contains: text } },
      ...phoneSearchWhere(text),
    ];
  }

  const pagination = parsePagination({ page, pageSize });
  const [total, items] = await Promise.all([
    prisma.customer.count({ where }),
    prisma.customer.findMany({
      where,
      select: customerSelect,
      orderBy: { name: "asc" },
      skip: pagination.skip,
      take: pagination.take,
    }),
  ]);

  return paginationResult(items.map(serializeCustomer), total, pagination);
}

export async function getCustomer(id, session) {
  const customer = await prisma.customer.findUnique({
    where: { id: Number(id) },
    select: {
      ...customerSelect,
      sales: {
        orderBy: { soldAt: "desc" },
        take: 50,
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
      workOrders: {
        orderBy: { openedAt: "desc" },
        take: 50,
        select: {
          id: true,
          number: true,
          type: true,
          status: true,
          servicePlace: true,
          reportedDefect: true,
          openedAt: true,
          closedAt: true,
          deliveredAt: true,
          productId: true,
          product: {
            select: {
              id: true,
              serialOnyx: true,
              catalogModel: { select: { commercialName: true } },
            },
          },
          unit: { select: { id: true, name: true } },
          labUnit: { select: { id: true, name: true } },
        },
      },
      saleOrders: {
        where: saleOrderAccessWhere(session),
        orderBy: { createdAt: "desc" },
        take: 50,
        select: {
          id: true,
          number: true,
          status: true,
          createdAt: true,
          orderedAt: true,
          closedAt: true,
          unit: { select: { id: true, name: true } },
          seller: { select: { id: true, name: true } },
          items: {
            where: { status: { not: "REMOVIDO" } },
            select: { id: true, status: true },
          },
        },
      },
    },
  });
  if (!customer) throw notFound("Cliente não encontrado.");
  const serialized = serializeCustomer(customer);
  return {
    ...serialized,
    sales: customer.sales.map((sale) => serializeSale(sale)),
    workOrders: customer.workOrders.map((order) => ({
      ...order,
      commercialName: order.product?.catalogModel?.commercialName || null,
      closed: WORK_ORDER_CLOSED_STATUSES.includes(order.status),
    })),
    saleOrders: (customer.saleOrders || []).map((order) => ({
      ...order,
      closed: Boolean(order.closedAt) || SALE_ORDER_CLOSED_STATUSES.includes(order.status),
      itemCount: order.items?.length || 0,
    })),
  };
}

export async function createCustomer(payload, actor) {
  const data = validateCustomerPayload(payload);
  const phones = parsePhoneEntries(payload);
  if (!phones?.length) throw validationError("Informe ao menos um telefone do cliente.");
  data.phone = phones[0].phone;

  const customer = await prisma.customer.create({
    data: {
      ...data,
      createdById: actor.id,
      phones: { create: phones },
    },
    select: customerSelect,
  });
  await writeAudit({
    userId: actor.id,
    action: "CUSTOMER_CREATED",
    entity: "customer",
    entityId: customer.id,
    newData: serializeCustomer(customer),
  });
  return serializeCustomer(customer);
}

export async function updateCustomer(id, payload, actor) {
  const current = await prisma.customer.findUnique({
    where: { id: Number(id) },
    include: { phones: true },
  });
  if (!current) throw notFound("Cliente não encontrado.");
  const data = validateCustomerPayload(payload, { partial: true });
  const phones = parsePhoneEntries(payload);
  if (phones) {
    if (!phones.length) throw validationError("Informe ao menos um telefone do cliente.");
    data.phone = phones[0].phone;
  }
  await prisma.customer.update({
    where: { id: current.id },
    data,
  });
  if (phones) await replaceCustomerPhones(current.id, phones);
  const updated = serializeCustomer(await prisma.customer.findUnique({ where: { id: current.id }, select: customerSelect }));
  await writeAudit({
    userId: actor.id,
    action: "CUSTOMER_UPDATED",
    entity: "customer",
    entityId: updated.id,
    oldData: serializeCustomer(current),
    newData: updated,
  });
  return updated;
}
