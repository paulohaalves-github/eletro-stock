import { prisma } from "../db";
import { notFound } from "../errors";
import { STATUSES, VOLTAGE_LABELS } from "../constants";
import { formatUnitAddress } from "../units";
import { normalizeWhatsAppPhone } from "../phone";
import { getCatalogSettings } from "./settings";
import { resolveUploadPath } from "./images";

const AVAILABLE_WHERE = {
  deletedAt: null,
  status: STATUSES.AVAILABLE,
  unit: { active: true, catalogVisible: true },
};

function slug(value) {
  const base = String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base || "item";
}

function productName(product) {
  const commercial = product.catalogModel?.commercialName?.trim();
  if (commercial) return commercial;
  const code = product.supplierModelCode?.trim();
  if (code) return code;
  const line = String(product.description || "").trim().split("\n")[0];
  return line.slice(0, 120) || "Produto";
}

function groupKey(product) {
  const model = product.catalogModel?.id ? `m${product.catalogModel.id}` : `n${slug(productName(product))}`;
  return `${model}-${slug(product.voltage || "sem-voltagem")}`.slice(0, 180);
}

function withoutConditionSuffix(key) {
  const value = String(key || "");
  const suffixes = ["novo-com-avaria", "revisado", "novo", "sem"];
  for (const suffix of suffixes) {
    const tail = `-${suffix}`;
    if (value.endsWith(tail) && value.length > tail.length) return value.slice(0, -tail.length);
  }
  return value;
}

function minPositive(values) {
  const nums = values.map(Number).filter((value) => value > 0);
  if (!nums.length) return 0;
  return Math.min(...nums);
}

function maxPositive(values) {
  const nums = values.map(Number).filter((value) => value > 0);
  if (!nums.length) return 0;
  return Math.max(...nums);
}

function mapsUrl(unit) {
  if (unit.latitude != null && unit.longitude != null) {
    return `https://www.google.com/maps?q=${unit.latitude},${unit.longitude}`;
  }
  const address = formatUnitAddress(unit);
  if (!address) return "";
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

function publicStore(unit, extra = {}) {
  return {
    id: unit.id,
    name: unit.name,
    city: unit.city || "",
    state: unit.state || "",
    address: formatUnitAddress(unit),
    email: unit.email || "",
    phone: unit.phone || "",
    phoneSecondary: unit.phoneSecondary || "",
    whatsapp: unit.whatsapp || "",
    mapsUrl: mapsUrl(unit),
    ...extra,
  };
}

export function whatsAppHref(phone, text) {
  const digits = normalizeWhatsAppPhone(phone);
  if (!digits) return "";
  const url = new URL(`https://wa.me/${digits}`);
  if (text) url.searchParams.set("text", text);
  return url.toString();
}

function paymentLabels(settings) {
  const items = [];
  if (settings.payCash) items.push({ id: "cash", label: "Dinheiro" });
  if (settings.payCard) items.push({ id: "card", label: "Cartão de crédito", note: "até 10x" });
  if (settings.payPix) items.push({ id: "pix", label: "Pix", note: "5% de desconto à vista" });
  return items;
}

async function loadAvailableProducts() {
  return prisma.product.findMany({
    where: AVAILABLE_WHERE,
    select: {
      id: true,
      voltage: true,
      cashPrice: true,
      installmentPrice: true,
      supplierModelCode: true,
      description: true,
      category: { select: { id: true, name: true } },
      catalogModel: {
        select: {
          id: true,
          commercialName: true,
          manufacturer: { select: { id: true, name: true } },
          specifications: true,
          commercialImages: {
            orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
            select: { id: true },
          },
        },
      },
      unit: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          phoneSecondary: true,
          whatsapp: true,
          street: true,
          addressNumber: true,
          neighborhood: true,
          city: true,
          state: true,
          zipCode: true,
          latitude: true,
          longitude: true,
        },
      },
      images: { where: { catalogPublic: true }, select: { id: true } },
    },
    orderBy: { id: "asc" },
  });
}

function buildGroups(products) {
  const groups = new Map();
  for (const product of products) {
    const key = groupKey(product);
    let group = groups.get(key);
    if (!group) {
      group = {
        key,
        name: productName(product),
        voltage: product.voltage || "",
        voltageLabel: VOLTAGE_LABELS[product.voltage] || product.voltage || "",
        categoryId: product.category?.id || null,
        categoryName: product.category?.name || "",
        manufacturerId: null,
        manufacturer: "",
        specifications: "",
        commercialImageIds: [],
        products: [],
      };
      groups.set(key, group);
    }
    const commercialIds = product.catalogModel?.commercialImages?.map((image) => image.id) || [];
    if (!group.commercialImageIds.length && commercialIds.length) group.commercialImageIds = commercialIds;
    if (!group.manufacturer && product.catalogModel?.manufacturer?.name) {
      group.manufacturerId = product.catalogModel.manufacturer.id;
      group.manufacturer = product.catalogModel.manufacturer.name;
    }
    if (!group.specifications && product.catalogModel?.specifications) group.specifications = product.catalogModel.specifications;
    group.products.push(product);
  }

  return [...groups.values()].map((group) => {
    const byUnit = new Map();
    for (const product of group.products) {
      const current = byUnit.get(product.unit.id) || { unit: product.unit, products: [] };
      current.products.push(product);
      byUnit.set(product.unit.id, current);
    }
    const units = [...byUnit.values()]
      .map(({ unit, products: rows }) => publicStore(unit, {
        count: rows.length,
        cashFrom: minPositive(rows.map((row) => row.cashPrice)),
        cashTo: maxPositive(rows.map((row) => row.cashPrice)),
        installmentFrom: minPositive(rows.map((row) => row.installmentPrice)),
        installmentTo: maxPositive(rows.map((row) => row.installmentPrice)),
        evidenceImageIds: [...new Set(rows.flatMap((row) => row.images.map((image) => image.id)))],
      }))
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
    const cashValues = group.products.map((row) => row.cashPrice);
    const installmentValues = group.products.map((row) => row.installmentPrice);
    return {
      key: group.key,
      name: group.name,
      voltage: group.voltage,
      voltageLabel: group.voltageLabel,
      categoryId: group.categoryId,
      categoryName: group.categoryName,
      manufacturerId: group.manufacturerId,
      manufacturer: group.manufacturer,
      specifications: group.specifications,
      commercialImageIds: group.commercialImageIds,
      count: group.products.length,
      cashFrom: minPositive(cashValues),
      cashTo: maxPositive(cashValues),
      installmentFrom: minPositive(installmentValues),
      installmentTo: maxPositive(installmentValues),
      units,
    };
  }).sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

function queryText(value) {
  return String(Array.isArray(value) ? value[0] : value || "").trim();
}

export async function getPublicCatalog(filters = {}) {
  const settings = await getCatalogSettings();
  const [products, stores] = await Promise.all([
    settings.online ? loadAvailableProducts() : Promise.resolve([]),
    prisma.unit.findMany({
      where: { active: true, catalogVisible: true },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        phoneSecondary: true,
        whatsapp: true,
        street: true,
        addressNumber: true,
        neighborhood: true,
        city: true,
        state: true,
        zipCode: true,
        latitude: true,
        longitude: true,
      },
      orderBy: { name: "asc" },
    }),
  ]);

  const groups = buildGroups(products);
  const q = queryText(filters.q).toLocaleLowerCase("pt-BR");
  const categoryId = Number(queryText(filters.categoria));
  const manufacturerId = Number(queryText(filters.fabricante));
  const unitId = Number(queryText(filters.unidade));

  const items = groups.filter((group) => {
    if (q && !`${group.name} ${group.categoryName} ${group.manufacturer}`.toLocaleLowerCase("pt-BR").includes(q)) return false;
    if (Number.isInteger(categoryId) && categoryId > 0 && group.categoryId !== categoryId) return false;
    if (Number.isInteger(manufacturerId) && manufacturerId > 0 && group.manufacturerId !== manufacturerId) return false;
    if (Number.isInteger(unitId) && unitId > 0 && !group.units.some((unit) => unit.id === unitId)) return false;
    return true;
  }).map((group) => {
    if (!Number.isInteger(unitId) || unitId <= 0) return group;
    const units = group.units.filter((unit) => unit.id === unitId);
    const cashValues = units.flatMap((unit) => [unit.cashFrom, unit.cashTo]);
    const installmentValues = units.flatMap((unit) => [unit.installmentFrom, unit.installmentTo]);
    return {
      ...group,
      units,
      count: units.reduce((sum, unit) => sum + unit.count, 0),
      cashFrom: minPositive(cashValues),
      cashTo: maxPositive(cashValues),
      installmentFrom: minPositive(installmentValues),
      installmentTo: maxPositive(installmentValues),
    };
  });

  const priceDesc = queryText(filters.ordem) === "preco-desc";
  items.sort((a, b) => {
    const aMissing = !(a.cashFrom > 0);
    const bMissing = !(b.cashFrom > 0);
    if (aMissing !== bMissing) return aMissing ? 1 : -1;
    const diff = priceDesc ? b.cashFrom - a.cashFrom : a.cashFrom - b.cashFrom;
    if (diff !== 0) return diff;
    return a.name.localeCompare(b.name, "pt-BR");
  });

  const categories = [...new Map(
    groups.filter((group) => group.categoryId).map((group) => [group.categoryId, group.categoryName]),
  ).entries()]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

  const manufacturers = [...new Map(
    groups.filter((group) => group.manufacturerId).map((group) => [group.manufacturerId, group.manufacturer]),
  ).entries()]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

  const stockedStores = [...new Map(
    groups.flatMap((group) => group.units).map((unit) => [unit.id, { id: unit.id, name: unit.name, city: unit.city }]),
  ).values()].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

  return {
    online: settings.online,
    offlineMessage: settings.offlineMessage,
    pickupNote: settings.pickupNote,
    payments: paymentLabels(settings),
    categories,
    manufacturers,
    stockedStores,
    stores: stores.map((store) => publicStore(store)),
    items,
    total: items.reduce((sum, item) => sum + item.count, 0),
  };
}

export async function getPublicCatalogItem(key) {
  const catalog = await getPublicCatalog();
  const direct = catalog.items.find((group) => group.key === key) || null;
  if (direct) return { ...catalog, item: direct, redirectTo: null };
  const clean = withoutConditionSuffix(key);
  const item = clean === key ? null : catalog.items.find((group) => group.key === clean) || null;
  return { ...catalog, item, redirectTo: item ? `/catalogo/item/${item.key}` : null };
}

function uploadPathFromFileUrl(fileUrl) {
  const marker = "/api/files/";
  const index = String(fileUrl || "").indexOf(marker);
  if (index < 0) throw notFound("Imagem não encontrada.");
  return resolveUploadPath(fileUrl.slice(index + marker.length));
}

export async function readCatalogImage(id) {
  const imageId = Number(id);
  if (!Number.isInteger(imageId) || imageId <= 0) throw notFound("Imagem não encontrada.");
  const image = await prisma.productImage.findFirst({
    where: {
      id: imageId,
      catalogPublic: true,
      product: AVAILABLE_WHERE,
    },
    select: { fileUrl: true },
  });
  if (!image) throw notFound("Imagem não encontrada.");
  return uploadPathFromFileUrl(image.fileUrl);
}

export async function readCatalogCommercialImage(id) {
  const imageId = Number(id);
  if (!Number.isInteger(imageId) || imageId <= 0) throw notFound("Imagem não encontrada.");
  const image = await prisma.catalogCommercialImage.findFirst({
    where: {
      id: imageId,
      catalogModel: { products: { some: AVAILABLE_WHERE } },
    },
    select: { fileUrl: true },
  });
  if (!image) throw notFound("Imagem não encontrada.");
  return uploadPathFromFileUrl(image.fileUrl);
}
