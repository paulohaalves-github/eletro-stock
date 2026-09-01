import path from "node:path";
import { mkdir, writeFile, unlink } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { prisma } from "../db";
import { conflict, validationError, notFound } from "../errors";
import { writeAudit, writeMovement } from "../audit";
import {
  DOCUMENT_EXTENSIONS,
  DOCUMENT_MIME_TYPES,
  IMAGE_EXTENSIONS,
  IMAGE_MIME_TYPES,
  MAX_IMAGES_PER_PRODUCT,
  MAX_UPLOAD_BYTES,
  MOVEMENT_TYPES,
} from "../constants";
import { getProduct } from "./products";

function uploadRoot() {
  return path.join(process.cwd(), process.env.UPLOAD_DIR || "uploads");
}

function extFromName(name = "") {
  const ext = path.extname(name).toLowerCase();
  return ext;
}

function assertImage(file) {
  const ext = extFromName(file.name);
  if (!IMAGE_EXTENSIONS.includes(ext)) {
    throw validationError("Formato de imagem inválido. Use JPG, PNG ou WEBP.");
  }
  if (!IMAGE_MIME_TYPES.includes(file.type)) {
    throw validationError("Tipo de arquivo não permitido.");
  }
}

function assertDocument(file) {
  const ext = extFromName(file.name);
  if (!DOCUMENT_EXTENSIONS.includes(ext) && !IMAGE_EXTENSIONS.includes(ext)) {
    throw validationError("Formato de anexo inválido.");
  }
  if (![...DOCUMENT_MIME_TYPES, ...IMAGE_MIME_TYPES].includes(file.type)) {
    throw validationError("Tipo de arquivo não permitido.");
  }
}

async function saveBuffer(relativeDir, filename, buffer) {
  const dir = path.join(uploadRoot(), relativeDir);
  await mkdir(dir, { recursive: true });
  const full = path.join(dir, filename);
  await writeFile(full, buffer);
  return `/api/files/${relativeDir}/${filename}`.replaceAll("\\", "/");
}

export async function addProductImages(productId, files, user, { setPrimary = false } = {}) {
  const product = await getProduct(productId);
  const currentCount = product.images.length;
  if (currentCount + files.length > MAX_IMAGES_PER_PRODUCT) {
    throw validationError(`Limite de ${MAX_IMAGES_PER_PRODUCT} imagens por produto.`);
  }

  const created = [];
  let index = 0;
  for (const file of files) {
    if (file.size > MAX_UPLOAD_BYTES) {
      throw validationError("Arquivo excede o tamanho máximo permitido.");
    }
    assertImage(file);
    const bytes = Buffer.from(await file.arrayBuffer());
    const optimized = await sharp(bytes)
      .rotate()
      .resize({ width: 1920, height: 1920, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer();

    const filename = `${randomUUID()}.webp`;
    const fileUrl = await saveBuffer(`products/${product.id}`, filename, optimized);
    const isPrimary = (setPrimary && index === 0 && currentCount === 0) || currentCount + index === 0;

    if (isPrimary) {
      await prisma.productImage.updateMany({
        where: { productId: product.id },
        data: { isPrimary: false },
      });
    }

    const image = await prisma.productImage.create({
      data: {
        productId: product.id,
        fileUrl,
        fileName: file.name || filename,
        mimeType: "image/webp",
        fileSize: optimized.length,
        isPrimary,
        uploadedById: user.id,
      },
    });
    created.push(image);
    index += 1;
  }

  await writeMovement({
    productId: product.id,
    type: MOVEMENT_TYPES.PHOTO_ADD,
    previousStatus: product.status,
    newStatus: product.status,
    observation: `${created.length} foto(s) adicionada(s)`,
    userId: user.id,
  });

  await writeAudit({
    userId: user.id,
    action: "IMAGE_UPLOADED",
    entity: "product",
    entityId: product.id,
    newData: { count: created.length },
  });

  return created;
}

export async function setPrimaryImage(productId, imageId, user) {
  const image = await prisma.productImage.findFirst({
    where: { id: Number(imageId), productId: Number(productId) },
  });
  if (!image) throw notFound("Imagem não encontrada.");

  await prisma.$transaction([
    prisma.productImage.updateMany({
      where: { productId: Number(productId) },
      data: { isPrimary: false },
    }),
    prisma.productImage.update({
      where: { id: image.id },
      data: { isPrimary: true },
    }),
  ]);

  await writeAudit({
    userId: user.id,
    action: "IMAGE_PRIMARY",
    entity: "product",
    entityId: Number(productId),
    newData: { imageId: image.id },
  });

  return getProduct(productId);
}

export async function deleteProductImage(productId, imageId, user) {
  const image = await prisma.productImage.findFirst({
    where: { id: Number(imageId), productId: Number(productId) },
  });
  if (!image) throw notFound("Imagem não encontrada.");

  await prisma.productImage.delete({ where: { id: image.id } });

  if (image.isPrimary) {
    const next = await prisma.productImage.findFirst({
      where: { productId: Number(productId) },
      orderBy: { createdAt: "asc" },
    });
    if (next) {
      await prisma.productImage.update({ where: { id: next.id }, data: { isPrimary: true } });
    }
  }

  try {
    const relative = image.fileUrl.replace(/^\/api\/files\//, "");
    await unlink(path.join(uploadRoot(), relative));
  } catch {
    // arquivo já pode ter sido removido
  }

  const product = await getProduct(productId);
  await writeMovement({
    productId: product.id,
    type: MOVEMENT_TYPES.PHOTO_REMOVE,
    previousStatus: product.status,
    newStatus: product.status,
    observation: `Imagem removida: ${image.fileName}`,
    userId: user.id,
  });
  await writeAudit({
    userId: user.id,
    action: "IMAGE_DELETED",
    entity: "product",
    entityId: product.id,
    oldData: { imageId: image.id, fileName: image.fileName },
  });

  return product;
}

export async function addProductFile(productId, file, user) {
  const product = await getProduct(productId);
  if (file.size > MAX_UPLOAD_BYTES) {
    throw validationError("Arquivo excede o tamanho máximo permitido.");
  }
  assertDocument(file);
  const bytes = Buffer.from(await file.arrayBuffer());
  const filename = `${randomUUID()}${extFromName(file.name)}`;
  const fileUrl = await saveBuffer(`products/${product.id}/docs`, filename, bytes);

  const created = await prisma.productFile.create({
    data: {
      productId: product.id,
      fileUrl,
      fileName: file.name || filename,
      mimeType: file.type,
      fileSize: file.size,
      uploadedById: user.id,
    },
  });

  await writeMovement({
    productId: product.id,
    type: MOVEMENT_TYPES.FILE_ADD,
    previousStatus: product.status,
    newStatus: product.status,
    observation: `Anexo: ${created.fileName}`,
    userId: user.id,
  });

  return created;
}

export async function deleteProductFile(productId, fileId, user) {
  const file = await prisma.productFile.findFirst({
    where: { id: Number(fileId), productId: Number(productId) },
  });
  if (!file) throw notFound("Anexo não encontrado.");
  await prisma.productFile.delete({ where: { id: file.id } });
  try {
    const relative = file.fileUrl.replace(/^\/api\/files\//, "");
    await unlink(path.join(uploadRoot(), relative));
  } catch {
    // ignore
  }
  await writeAudit({
    userId: user.id,
    action: "FILE_DELETED",
    entity: "product",
    entityId: Number(productId),
    oldData: { fileId: file.id, fileName: file.fileName },
  });
}

export function resolveUploadPath(relativePath) {
  const root = path.resolve(uploadRoot());
  const full = path.resolve(root, relativePath);
  if (!full.startsWith(root)) {
    throw conflict("Caminho de arquivo inválido.");
  }
  return full;
}
