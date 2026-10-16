import { readFile, readdir, stat, unlink } from "node:fs/promises";
import path from "node:path";
import { prisma } from "../db";
import { validationError, notFound } from "../errors";
import { writeAudit } from "../audit";
import { VOLTAGE_LABELS } from "../constants";
import { assertProductWritable } from "../units";
import { getProduct } from "./products";
import { resolveUploadPath, saveWebpUpload } from "./images";
import { lookupIcecat } from "./icecat";
import { findOrCreateManufacturer, normalizeManufacturerName } from "./manufacturers";
import { lookupProductWithAi } from "./product-research";
import { downloadPublicImage, imageUrlsFromPages } from "../remote-image";

const MAX_COMMERCIAL_IMAGES = 12;
const MAX_LOOKUP_IMAGES = 6;

async function writableModel(productId, user) {
  const product = await getProduct(productId);
  assertProductWritable(user, product);
  if (!product.catalogModelId) {
    throw validationError("Informe o Model Code e o nome comercial para guardar a ficha deste modelo.");
  }
  return product;
}

function snapshot(product) {
  return {
    commercialName: product.catalogModel?.commercialName || "",
    manufacturer: product.catalogModel?.manufacturer?.name || "",
    specifications: product.catalogModel?.specifications || "",
    marketPrice: Number(product.marketPrice || 0),
    voltage: product.voltage || "",
    images: (product.catalogModel?.commercialImages || []).map((image) => ({
      id: image.id,
      fileUrl: image.fileUrl,
    })),
  };
}

function text(value, max) {
  return String(value || "").trim().slice(0, max);
}

function proposedPrice(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0 || number > 1000000) return null;
  return Math.round(number * 100) / 100;
}

function proposedVoltage(value) {
  const voltage = text(value, 20);
  return VOLTAGE_LABELS[voltage] ? voltage : "";
}

function previewRelative(fileUrl) {
  const marker = "/api/files/";
  const index = String(fileUrl || "").indexOf(marker);
  if (index < 0) return null;
  const relative = fileUrl.slice(index + marker.length);
  if (!relative.startsWith("lookup-previews/") || relative.includes("..")) return null;
  return relative;
}

async function sweepOldPreviews() {
  const dir = path.join(process.cwd(), "uploads", "lookup-previews");
  const names = await readdir(dir).catch(() => []);
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  await Promise.all(names.map(async (name) => {
    const full = path.join(dir, name);
    const info = await stat(full).catch(() => null);
    if (info && info.mtimeMs < cutoff) await unlink(full).catch(() => {});
  }));
}

async function localPreviews(urls) {
  const saved = [];
  for (const imageUrl of [...new Set(urls)].slice(0, 8)) {
    if (saved.length >= MAX_LOOKUP_IMAGES) break;
    const bytes = await downloadPublicImage(imageUrl);
    if (!bytes) continue;
    try {
      const stored = await saveWebpUpload("lookup-previews", bytes);
      saved.push(stored.fileUrl);
    } catch {
      // arquivo que não é uma imagem utilizável
    }
  }
  return saved;
}

async function removeStoredFile(fileUrl) {
  const marker = "/api/files/";
  const index = String(fileUrl || "").indexOf(marker);
  if (index < 0) return;
  try {
    await unlink(resolveUploadPath(fileUrl.slice(index + marker.length)));
  } catch {
    // o arquivo já pode ter sido removido
  }
}

export async function previewCommercialLookup(productId, user, payload = {}) {
  const product = await writableModel(productId, user);
  const source = payload.source === "ai" || payload.source === "icecat" ? payload.source : "";
  if (!source) throw validationError("Escolha a consulta pelo Icecat ou por IA.");

  const brand = text(payload.manufacturer, 160) || product.catalogModel?.manufacturer?.name || "";
  const productCode = product.supplierModelCode || product.catalogModel?.supplierModelCode || "";
  let found;
  if (source === "icecat") {
    const sheet = await lookupIcecat({ ean: product.ean, brand, productCode });
    found = {
      commercialName: "",
      manufacturer: sheet.manufacturer || "",
      specifications: sheet.specifications || "",
      marketPrice: null,
      priceLow: null,
      priceHigh: null,
      voltage: "",
      imageUrls: (sheet.imageUrls || []).slice(0, MAX_LOOKUP_IMAGES),
      sources: [],
      notes: "",
    };
  } else {
    found = await lookupProductWithAi({
      ean: product.ean,
      brand,
      productCode,
      commercialName: product.catalogModel?.commercialName,
      category: product.category?.name,
    });
  }

  void sweepOldPreviews();
  let imageUrls = await localPreviews(found.imageUrls || []);
  if (imageUrls.length < 2 && found.sources?.length) {
    const fromPages = await imageUrlsFromPages(found.sources.map((source) => source.url));
    const extra = await localPreviews(fromPages);
    imageUrls = [...imageUrls, ...extra.filter((url) => !imageUrls.includes(url))].slice(0, MAX_LOOKUP_IMAGES);
  }

  return {
    source,
    notes: found.notes || "",
    sources: found.sources || [],
    priceLow: found.priceLow ?? null,
    priceHigh: found.priceHigh ?? null,
    current: snapshot(product),
    proposed: {
      commercialName: text(found.commercialName, 190),
      manufacturer: text(found.manufacturer, 160),
      specifications: text(found.specifications, 12000),
      marketPrice: proposedPrice(found.marketPrice),
      voltage: proposedVoltage(found.voltage),
      imageUrls,
    },
  };
}

export async function applyCommercialLookup(productId, user, payload = {}) {
  const product = await writableModel(productId, user);
  const source = payload.source === "ai" || payload.source === "icecat" ? payload.source : "";
  if (!source) throw validationError("Escolha a consulta pelo Icecat ou por IA.");

  const apply = payload.apply || {};
  const values = payload.values || {};
  const flags = {
    commercialName: Boolean(apply.commercialName),
    manufacturer: Boolean(apply.manufacturer),
    specifications: Boolean(apply.specifications),
    marketPrice: Boolean(apply.marketPrice),
    voltage: Boolean(apply.voltage),
    replaceImages: Boolean(apply.replaceImages),
  };
  const imageUrls = [...new Set((Array.isArray(values.imageUrls) ? values.imageUrls : []).map((url) => text(url, 2000)).filter(Boolean))].slice(0, MAX_LOOKUP_IMAGES);
  const selected = Object.entries(flags).filter(([key, value]) => key !== "replaceImages" && value);
  if (!selected.length && !imageUrls.length) throw validationError("Marque ao menos uma informação para alterar.");
  if (flags.replaceImages && !imageUrls.length) {
    throw validationError("Marque ao menos uma foto nova antes de remover as fotos atuais.");
  }

  const modelData = {};
  if (flags.commercialName) {
    const commercialName = text(values.commercialName, 190);
    if (!commercialName) throw validationError("A consulta não trouxe um nome comercial.");
    modelData.commercialName = commercialName;
  }
  if (flags.manufacturer) {
    const manufacturer = await findOrCreateManufacturer(values.manufacturer, user);
    if (!manufacturer) throw validationError("A consulta não trouxe um fabricante.");
    modelData.manufacturerId = manufacturer.id;
  }
  if (flags.specifications) {
    const specifications = text(values.specifications, 12000);
    if (!specifications) throw validationError("A consulta não trouxe uma descrição.");
    modelData.specifications = specifications;
  }

  const productData = {};
  if (flags.marketPrice) {
    const marketPrice = proposedPrice(values.marketPrice);
    if (marketPrice == null) throw validationError("A consulta não trouxe um preço de mercado válido.");
    productData.marketPrice = marketPrice;
    productData.lastPriceUpdateAt = new Date();
  }
  if (flags.voltage) {
    const voltage = proposedVoltage(values.voltage);
    if (!voltage) throw validationError("A consulta não trouxe uma tensão válida.");
    productData.voltage = voltage;
  }

  const currentImages = flags.replaceImages || imageUrls.length
    ? await prisma.catalogCommercialImage.findMany({ where: { catalogModelId: product.catalogModelId } })
    : [];
  const room = flags.replaceImages
    ? MAX_COMMERCIAL_IMAGES
    : Math.max(0, MAX_COMMERCIAL_IMAGES - currentImages.length);
  const downloaded = [];
  const usedPreviews = [];
  for (const imageUrl of imageUrls.slice(0, room)) {
    const relative = previewRelative(imageUrl);
    let bytes = null;
    if (relative) {
      try {
        bytes = await readFile(resolveUploadPath(relative));
      } catch {
        bytes = null;
      }
      if (bytes) usedPreviews.push(imageUrl);
    } else {
      bytes = await downloadPublicImage(imageUrl);
    }
    if (!bytes?.length) continue;
    try {
      downloaded.push(await saveWebpUpload(`catalog-models/${product.catalogModelId}`, bytes));
    } catch {
      // arquivo que não é uma imagem utilizável
    }
  }
  if (imageUrls.length && !downloaded.length && !Object.keys(modelData).length && !Object.keys(productData).length) {
    if (!room) throw validationError("Este modelo já tem 12 fotos comerciais. Remova alguma ou marque para substituir as atuais.");
    throw validationError("Não foi possível baixar as fotos marcadas.");
  }

  const imageSource = source === "icecat" ? "icecat" : "ai";
  await prisma.$transaction(async (tx) => {
    if (Object.keys(modelData).length) {
      await tx.catalogModel.update({ where: { id: product.catalogModelId }, data: modelData });
    }
    if (Object.keys(productData).length) {
      await tx.product.update({ where: { id: product.id }, data: productData });
    }
    if (flags.replaceImages && downloaded.length) {
      await tx.catalogCommercialImage.deleteMany({ where: { catalogModelId: product.catalogModelId } });
    }
    const start = flags.replaceImages ? 0 : currentImages.reduce((max, image) => Math.max(max, image.sortOrder), -1) + 1;
    for (const [index, stored] of downloaded.entries()) {
      await tx.catalogCommercialImage.create({
        data: {
          catalogModelId: product.catalogModelId,
          ...stored,
          source: imageSource,
          sortOrder: start + index,
        },
      });
    }
  });

  if (flags.replaceImages && downloaded.length) {
    await Promise.all(currentImages.map((image) => removeStoredFile(image.fileUrl)));
  }
  await Promise.all(usedPreviews.map((fileUrl) => removeStoredFile(fileUrl)));

  await writeAudit({
    userId: user.id,
    action: "COMMERCIAL_LOOKUP_APPLIED",
    entity: "catalog_model",
    entityId: product.catalogModelId,
    newData: {
      productId: product.id,
      source,
      fields: selected.map(([key]) => key),
      images: downloaded.length,
      replacedImages: Boolean(flags.replaceImages && downloaded.length),
      manufacturer: modelData.manufacturerId ? normalizeManufacturerName(values.manufacturer) : undefined,
    },
  });

  const updated = await getProduct(productId);
  const parts = ["Ficha atualizada com o que você marcou."];
  if (imageUrls.length && !downloaded.length) parts.push(!room ? "As fotos não foram salvas porque o modelo já tem 12." : "Nenhuma foto pôde ser salva.");
  else if (downloaded.length) parts.push(`${downloaded.length} foto(s) comercial(is) salva(s).`);
  if (downloaded.length && downloaded.length < Math.min(imageUrls.length, room)) parts.push("Algumas fotos não puderam ser baixadas.");
  if (imageUrls.length > room) parts.push("Parte das fotos ficou de fora por causa do limite de 12.");
  if (!updated) throw notFound("Produto não encontrado.");
  return { product: updated, message: parts.join(" ") };
}
