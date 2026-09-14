import { prisma } from "../db";
import { conflict, notFound, validationError } from "../errors";
import { writeAudit } from "../audit";
import { STATUSES, WARRANTY_MONTHS, isWarrantyValid, warrantyExpiresAt } from "../constants";
import { emptyToNull, parseId } from "../validations";
import { requireActiveUnit, unitSelect } from "../units";
import { getProduct } from "./products";

const saleInclude = {
  customer: true,
  unit: { select: unitSelect },
  createdBy: { select: { id: true, name: true } },
  product: {
    select: {
      id: true,
      serialOnyx: true,
      status: true,
      catalogModel: { select: { commercialName: true } },
      category: { select: { id: true, name: true } },
    },
  },
};

export function serializeSale(sale) {
  if (!sale) return null;
  const expiresAt = warrantyExpiresAt(sale.soldAt, sale.warrantyMonths);
  return {
    ...sale,
    commercialName: sale.product?.catalogModel?.commercialName || null,
    warrantyExpiresAt: expiresAt,
    warrantyValid: isWarrantyValid(sale.soldAt, sale.warrantyMonths),
  };
}

export async function getLatestSale(productId) {
  const sale = await prisma.sale.findFirst({
    where: { productId: Number(productId) },
    include: saleInclude,
    orderBy: { soldAt: "desc" },
  });
  return sale ? serializeSale(sale) : null;
}

export async function getSaleOrThrow(id) {
  const sale = await prisma.sale.findUnique({
    where: { id: Number(id) },
    include: saleInclude,
  });
  if (!sale) throw notFound("Venda não encontrada.");
  return serializeSale(sale);
}

function parseWarrantyMonths(value) {
  const months = Number(value);
  if (!WARRANTY_MONTHS.includes(months)) {
    throw validationError("Informe a garantia entre 1 e 12 meses.");
  }
  return months;
}

function parseSoldAt(value) {
  if (!value) return new Date();
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw validationError("Data da venda inválida.");
  if (date > new Date()) throw validationError("A data da venda não pode ser futura.");
  return date;
}

export async function createSale({
  productId,
  customerId,
  warrantyMonths,
  invoiceNumber,
  soldAt,
  observation,
  user,
  product: currentProduct,
  fromExit = false,
}) {
  const unitId = requireActiveUnit(user);
  const product = currentProduct || await getProduct(productId);
  if (product.status !== STATUSES.SOLD) {
    throw validationError("Só é possível registrar venda de produto com status vendido.");
  }

  const customer = await prisma.customer.findUnique({ where: { id: parseId(customerId) } });
  if (!customer) throw notFound("Cliente não encontrado.");

  if (!fromExit) {
    const existing = await prisma.sale.findFirst({
      where: { productId: product.id },
      select: { id: true },
    });
    if (existing) throw conflict("Este produto já possui uma venda registrada.");
  }

  const invoice = String(invoiceNumber || "").trim();
  if (!invoice) throw validationError("Informe o número da NF.");

  const sale = await prisma.sale.create({
    data: {
      productId: product.id,
      customerId: customer.id,
      unitId: product.unitId || unitId,
      soldAt: parseSoldAt(soldAt),
      warrantyMonths: parseWarrantyMonths(warrantyMonths),
      invoiceNumber: invoice,
      observation: emptyToNull(observation),
      createdById: user.id,
    },
    include: saleInclude,
  });

  await writeAudit({
    userId: user.id,
    action: "SALE_CREATED",
    entity: "sale",
    entityId: sale.id,
    newData: { productId: product.id, customerId: customer.id, warrantyMonths: sale.warrantyMonths, invoiceNumber: sale.invoiceNumber },
  });

  return serializeSale(sale);
}

export async function assertSaleForRepair(productId) {
  const sale = await getLatestSale(productId);
  if (!sale) {
    throw validationError("Registre a venda deste produto (cliente e garantia) antes de abrir a ordem de serviço.");
  }
  if (!sale.warrantyValid) {
    throw validationError("A garantia deste produto já venceu. Fora de garantia não é atendido neste módulo.");
  }
  return sale;
}
