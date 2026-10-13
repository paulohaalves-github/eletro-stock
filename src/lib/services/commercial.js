import { unlink } from "node:fs/promises";
import { prisma } from "../db";
import { validationError, notFound } from "../errors";
import { writeAudit } from "../audit";
import { IMAGE_MIME_TYPES, MAX_UPLOAD_BYTES } from "../constants";
import { assertProductWritable } from "../units";
import { getProduct } from "./products";
import { resolveUploadPath, saveWebpUpload } from "./images";
import { assertIcecatImageUrl, lookupIcecat } from "./icecat";
import { findOrCreateManufacturer, resolveManufacturer } from "./manufacturers";

const MAX_COMMERCIAL_IMAGES = 12;

async function writableModel(productId, user) {
  const product = await getProduct(productId);
  assertProductWritable(user, product);
  if (!product.catalogModelId) {
    throw validationError("Informe o Model Code e o nome comercial para guardar a ficha deste modelo.");
  }
  return product;
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

export async function saveCommercialSheet(productId, payload, user) {
  const product = await writableModel(productId, user);
  const specifications = String(payload.specifications || "").trim();
  if (specifications.length > 12000) throw validationError("A descrição deve ter no máximo 12000 caracteres.");
  const manufacturer = await resolveManufacturer(payload, user);

  await prisma.catalogModel.update({
    where: { id: product.catalogModelId },
    data: {
      manufacturerId: manufacturer?.id || null,
      specifications: specifications || null,
    },
  });

  await writeAudit({
    userId: user.id,
    action: "COMMERCIAL_SHEET_UPDATED",
    entity: "catalog_model",
    entityId: product.catalogModelId,
    newData: { productId: product.id, manufacturer: manufacturer?.name || null },
  });

  return getProduct(productId);
}

async function downloadIcecatImage(imageUrl) {
  let url;
  try {
    url = assertIcecatImageUrl(imageUrl);
  } catch {
    return null;
  }
  let response;
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(20000) });
  } catch {
    return null;
  }
  if (!response.ok) return null;
  const bytes = Buffer.from(await response.arrayBuffer());
  if (!bytes.length || bytes.length > MAX_UPLOAD_BYTES) return null;
  return bytes;
}

export async function importCommercialFromIcecat(productId, user, payload = {}) {
  const product = await writableModel(productId, user);
  const sheet = await lookupIcecat({
    ean: product.ean,
    brand: payload.manufacturer || product.catalogModel?.manufacturer?.name,
    productCode: product.supplierModelCode || product.catalogModel?.supplierModelCode,
  });
  const current = await prisma.catalogModel.findUnique({
    where: { id: product.catalogModelId },
    include: { commercialImages: true },
  });
  if (!current) throw notFound("Modelo comercial não encontrado.");

  const data = {};
  if (sheet.manufacturer) {
    const manufacturer = await findOrCreateManufacturer(sheet.manufacturer, user);
    if (manufacturer) data.manufacturerId = manufacturer.id;
  }
  if (sheet.specifications) data.specifications = sheet.specifications;
  if (Object.keys(data).length) {
    await prisma.catalogModel.update({ where: { id: current.id }, data });
  }

  const previous = current.commercialImages.filter((image) => image.source === "icecat");
  const kept = current.commercialImages.length - previous.length;
  const room = Math.max(0, MAX_COMMERCIAL_IMAGES - kept);
  const downloaded = [];
  for (const imageUrl of sheet.imageUrls.slice(0, room)) {
    const bytes = await downloadIcecatImage(imageUrl);
    if (bytes) downloaded.push(bytes);
  }
  let savedImages = 0;
  if (downloaded.length) {
    if (previous.length) {
      await prisma.catalogCommercialImage.deleteMany({
        where: { id: { in: previous.map((image) => image.id) } },
      });
      await Promise.all(previous.map((image) => removeStoredFile(image.fileUrl)));
    }
    if (kept) {
      await prisma.catalogCommercialImage.updateMany({
        where: { catalogModelId: current.id, source: "upload" },
        data: { sortOrder: { increment: downloaded.length } },
      });
    }
    for (const [index, bytes] of downloaded.entries()) {
      const stored = await saveWebpUpload(`catalog-models/${current.id}`, bytes);
      await prisma.catalogCommercialImage.create({
        data: {
          catalogModelId: current.id,
          ...stored,
          source: "icecat",
          sortOrder: index,
        },
      });
      savedImages += 1;
    }
  }

  await writeAudit({
    userId: user.id,
    action: "COMMERCIAL_ICECAT_IMPORTED",
    entity: "catalog_model",
    entityId: current.id,
    newData: {
      productId: product.id,
      manufacturerId: data.manufacturerId || current.manufacturerId || null,
      images: savedImages,
    },
  });

  const updated = await getProduct(productId);
  const message = savedImages
    ? "Ficha e fotos comerciais atualizadas pelo Icecat."
    : "Ficha atualizada pelo Icecat. Nenhuma foto comercial nova foi salva.";
  return { product: updated, message };
}

export async function addCommercialImages(productId, files, user) {
  const product = await writableModel(productId, user);
  if (!files.length) throw validationError("Selecione ao menos uma imagem.");
  const current = await prisma.catalogCommercialImage.count({
    where: { catalogModelId: product.catalogModelId },
  });
  if (current + files.length > MAX_COMMERCIAL_IMAGES) {
    throw validationError(`Limite de ${MAX_COMMERCIAL_IMAGES} fotos comerciais por modelo.`);
  }

  const last = await prisma.catalogCommercialImage.aggregate({
    where: { catalogModelId: product.catalogModelId },
    _max: { sortOrder: true },
  });
  let sortOrder = (last._max.sortOrder ?? -1) + 1;
  const created = [];
  for (const file of files) {
    if (file.size > MAX_UPLOAD_BYTES) throw validationError("Arquivo excede o tamanho máximo permitido.");
    if (!IMAGE_MIME_TYPES.includes(file.type)) throw validationError("Tipo de arquivo não permitido.");
    const stored = await saveWebpUpload(`catalog-models/${product.catalogModelId}`, Buffer.from(await file.arrayBuffer()));
    created.push(await prisma.catalogCommercialImage.create({
      data: {
        catalogModelId: product.catalogModelId,
        ...stored,
        source: "upload",
        sortOrder,
      },
    }));
    sortOrder += 1;
  }

  await writeAudit({
    userId: user.id,
    action: "COMMERCIAL_IMAGES_ADDED",
    entity: "catalog_model",
    entityId: product.catalogModelId,
    newData: { productId: product.id, count: created.length },
  });

  return getProduct(productId);
}

export async function deleteCommercialImage(productId, imageId, user) {
  const product = await writableModel(productId, user);
  const image = await prisma.catalogCommercialImage.findFirst({
    where: { id: Number(imageId), catalogModelId: product.catalogModelId },
  });
  if (!image) throw notFound("Imagem não encontrada.");
  await prisma.catalogCommercialImage.delete({ where: { id: image.id } });
  await removeStoredFile(image.fileUrl);
  await writeAudit({
    userId: user.id,
    action: "COMMERCIAL_IMAGE_DELETED",
    entity: "catalog_model",
    entityId: product.catalogModelId,
    newData: { productId: product.id, imageId: image.id },
  });
  return getProduct(productId);
}
