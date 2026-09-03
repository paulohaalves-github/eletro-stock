import { prisma } from "../db";
import { conflict, notFound, validationError } from "../errors";
import { writeAudit, writeMovement } from "../audit";
import { CONDITIONS, MOVEMENT_TYPES, STATUSES } from "../constants";
import { emptyToNull, validateProductPayload } from "../validations";
import { resolveCatalogModel } from "./catalog-models";

function serializeProduct(product) {
  if (!product) return null;
  const primary = product.images?.find((image) => image.isPrimary) || product.images?.[0] || null;
  return {
    ...product,
    commercialName: product.catalogModel?.commercialName || null,
    primaryImage: primary,
  };
}

export async function ensureUniqueSerial(serialOnyx, excludeId) {
  const serial = emptyToNull(serialOnyx);
  if (!serial) {
    throw validationError("Informe o Serial Onyx.");
  }
  const existing = await prisma.product.findFirst({
    where: {
      serialOnyx: serial,
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: { id: true },
  });
  if (existing) {
    throw conflict("Este Serial Onyx já está cadastrado.");
  }
}

function expandToken(token) {
  const synonyms = {
    tv: ["TV", "Televisão", "televisao"],
    televisão: ["TV", "Televisão"],
    celular: ["Celular", "smartphone", "Galaxy", "iPhone"],
    fone: ["Fones", "headphone", "airpods"],
    geladeira: ["Refrigerador", "geladeira"],
  };
  return synonyms[token.toLowerCase()] || [token];
}

function buildSearchWhere(query) {
  const text = String(query || "").trim();
  if (!text) return {};

  const tokens = text.split(/\s+/).filter(Boolean);
  return {
    AND: tokens.map((token) => {
      const variants = expandToken(token);
      const or = variants.flatMap((variant) => [
        { serialOnyx: { contains: variant } },
        { supplierModelCode: { contains: variant } },
        { ean: { contains: variant } },
        { capacitySizeType: { contains: variant } },
        { description: { contains: variant } },
        { damageDescription: { contains: variant } },
        { category: { name: { contains: variant } } },
        { line: { name: { contains: variant } } },
        { catalogModel: { commercialName: { contains: variant } } },
        { catalogModel: { supplierModelCode: { contains: variant } } },
      ]);
      const numeric = Number(token.replace(/^#/, ""));
      if (Number.isInteger(numeric) && numeric > 0) {
        or.push({ id: numeric });
      }
      return { OR: or };
    }),
  };
}

export async function listProducts(filters = {}) {
  const {
    q,
    categoryId,
    lineId,
    condition,
    status,
    minPrice,
    maxPrice,
    from,
    to,
    page = 1,
    pageSize = 24,
    view = "table",
  } = filters;

  const where = {
    ...buildSearchWhere(q),
  };

  if (categoryId) where.categoryId = Number(categoryId);
  if (lineId) where.lineId = Number(lineId);
  if (condition) where.condition = condition;
  if (status) where.status = status;
  if (minPrice || maxPrice) {
    where.cashPrice = {};
    if (minPrice) where.cashPrice.gte = Number(minPrice);
    if (maxPrice) where.cashPrice.lte = Number(maxPrice);
  }
  if (from || to) {
    where.entryDate = {};
    if (from) where.entryDate.gte = new Date(from);
    if (to) {
      const end = new Date(to);
      end.setHours(23, 59, 59, 999);
      where.entryDate.lte = end;
    }
  }

  const take = Math.min(Number(pageSize) || 24, 100);
  const skip = (Math.max(Number(page) || 1, 1) - 1) * take;

  const [total, items] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      include: {
        category: true,
        line: true,
        catalogModel: true,
        images: { orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }] },
        createdBy: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take,
    }),
  ]);

  return {
    items: items.map(serializeProduct),
    total,
    page: Math.max(Number(page) || 1, 1),
    pageSize: take,
    view,
  };
}

export async function getProduct(id) {
  const product = await prisma.product.findUnique({
    where: { id: Number(id) },
    include: {
      category: true,
      line: true,
      catalogModel: true,
      createdBy: { select: { id: true, name: true, email: true } },
      images: {
        include: { uploadedBy: { select: { id: true, name: true } } },
        orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
      },
      files: {
        include: { uploadedBy: { select: { id: true, name: true } } },
        orderBy: { createdAt: "desc" },
      },
      movements: {
        include: { user: { select: { id: true, name: true } } },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!product) throw notFound("Produto não encontrado.");
  return serializeProduct(product);
}

export async function getProductsByIds(ids) {
  const unique = [...new Set((ids || []).map(Number).filter((id) => Number.isInteger(id) && id > 0))].slice(0, 200);
  if (!unique.length) return [];

  const items = await prisma.product.findMany({
    where: { id: { in: unique } },
    include: { catalogModel: true },
  });
  const byId = new Map(items.map((item) => [item.id, serializeProduct(item)]));
  return unique.map((id) => byId.get(id)).filter(Boolean);
}

export async function createProduct(payload, user) {
  const data = validateProductPayload(payload);
  const commercialName = data.commercialName;
  delete data.commercialName;
  await ensureUniqueSerial(data.serialOnyx);

  if (data.categoryId) {
    const category = await prisma.category.findUnique({ where: { id: data.categoryId } });
    if (!category || !category.active) throw validationError("Categoria inválida.");
  }
  if (data.lineId) {
    const line = await prisma.line.findUnique({ where: { id: data.lineId } });
    if (!line || !line.active) throw validationError("Linha inválida.");
  }

  const catalog = await resolveCatalogModel(data.supplierModelCode, commercialName);

  const product = await prisma.product.create({
    data: {
      ...data,
      catalogModelId: catalog.catalogModelId,
      supplierModelCode: catalog.supplierModelCode,
      status: STATUSES.AVAILABLE,
      createdById: user.id,
    },
    include: {
      category: true,
      line: true,
      catalogModel: true,
      images: true,
    },
  });

  await writeMovement({
    productId: product.id,
    type: MOVEMENT_TYPES.ENTRY,
    previousStatus: null,
    newStatus: STATUSES.AVAILABLE,
    observation: payload.observation || "Entrada de estoque",
    origin: data.origin,
    userId: user.id,
  });

  await writeAudit({
    userId: user.id,
    action: "PRODUCT_CREATED",
    entity: "product",
    entityId: product.id,
    newData: product,
  });

  return serializeProduct(product);
}

export async function updateProduct(id, payload, user) {
  const current = await getProduct(id);
  const data = validateProductPayload(payload, { partial: true });
  const commercialName = data.commercialName;
  delete data.commercialName;

  if (data.serialOnyx !== undefined) {
    await ensureUniqueSerial(data.serialOnyx, current.id);
  }

  if (data.condition === CONDITIONS.NEW_DAMAGE) {
    const damage = data.damageDescription ?? current.damageDescription;
    if (!damage) throw validationError("Preencha a descrição da avaria.");
  }

  if (data.supplierModelCode !== undefined || commercialName !== undefined) {
    const catalog = await resolveCatalogModel(
      data.supplierModelCode !== undefined ? data.supplierModelCode : current.supplierModelCode,
      commercialName !== undefined ? commercialName : current.commercialName,
    );
    data.catalogModelId = catalog.catalogModelId;
    data.supplierModelCode = catalog.supplierModelCode;
  }

  const updated = await prisma.product.update({
    where: { id: current.id },
    data,
    include: {
      category: true,
      line: true,
      catalogModel: true,
      images: true,
    },
  });

  const changes = [];
  if (data.condition && data.condition !== current.condition) {
    changes.push("condição");
    await writeMovement({
      productId: current.id,
      type: MOVEMENT_TYPES.CONDITION_CHANGE,
      previousStatus: current.status,
      newStatus: current.status,
      observation: `Condição: ${current.condition} → ${data.condition}`,
      userId: user.id,
    });
  }

  const priceFields = ["cashPrice", "installmentPrice", "marketPrice"];
  const priceChanged = priceFields.some(
    (field) => data[field] !== undefined && Number(data[field]) !== Number(current[field]),
  );
  if (priceChanged) {
    changes.push("preço");
    await writeMovement({
      productId: current.id,
      type: MOVEMENT_TYPES.PRICE_CHANGE,
      previousStatus: current.status,
      newStatus: current.status,
      observation: "Preços atualizados",
      userId: user.id,
    });
  }

  if (!priceChanged && !(data.condition && data.condition !== current.condition)) {
    await writeMovement({
      productId: current.id,
      type: MOVEMENT_TYPES.UPDATE,
      previousStatus: current.status,
      newStatus: current.status,
      observation: payload.observation || "Produto atualizado",
      userId: user.id,
    });
  }

  await writeAudit({
    userId: user.id,
    action: "PRODUCT_UPDATED",
    entity: "product",
    entityId: current.id,
    oldData: current,
    newData: updated,
  });

  return serializeProduct(updated);
}

export async function searchProducts(query, limit = 8) {
  if (!String(query || "").trim()) return [];
  const result = await listProducts({ q: query, pageSize: limit, page: 1 });
  return result.items;
}
