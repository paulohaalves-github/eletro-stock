import path from "node:path";
import { randomUUID } from "node:crypto";
import { validationError } from "../errors";
import {
  IMAGE_EXTENSIONS,
  IMAGE_MIME_TYPES,
  INBOX_DOCUMENT_EXTENSIONS,
  INBOX_DOCUMENT_MIME_TYPES,
  INBOX_MAX_UPLOAD_BYTES,
  INBOX_VIDEO_EXTENSIONS,
  INBOX_VIDEO_MIME_TYPES,
} from "../constants";
import { extFromName, saveBuffer } from "./images";

export function inboxMediaKind(mimeType, mediaType, fileName) {
  const mime = String(mimeType || mediaType || "").toLowerCase();
  const ext = extFromName(fileName || "");
  if (mime.startsWith("image/") || mime === "image" || IMAGE_EXTENSIONS.includes(ext)) return "image";
  if (mime.startsWith("video/") || mime === "video" || INBOX_VIDEO_EXTENSIONS.includes(ext)) return "video";
  if (mime.startsWith("audio/") || mime === "audio") return "audio";
  if (mime === "document" || mime.startsWith("application/") || mime === "text/plain" || INBOX_DOCUMENT_EXTENSIONS.includes(ext)) {
    return "document";
  }
  return mime ? "document" : null;
}

export function inboxMediaPreview(body, mimeType, mediaType, fileName) {
  const text = String(body || "").replace(/\s+/g, " ").trim();
  if (text) return text.slice(0, 180);
  const kind = inboxMediaKind(mimeType, mediaType, fileName);
  if (kind === "image") return "[Imagem]";
  if (kind === "video") return "[Vídeo]";
  if (kind === "document") return "[Documento]";
  if (kind === "audio") return "[Áudio]";
  return fileName || "[Arquivo]";
}

export async function saveInboxAttachment(conversationId, file, { prefix = "inbox" } = {}) {
  if (!file || typeof file.arrayBuffer !== "function") {
    throw validationError("Selecione um arquivo.");
  }
  if (file.size > INBOX_MAX_UPLOAD_BYTES) {
    throw validationError("Arquivo excede o tamanho máximo permitido.");
  }
  const mime = String(file.type || "").toLowerCase();
  const ext = extFromName(file.name);
  const kind = inboxMediaKind(mime, null, file.name);
  const allowed = new Set([
    ...IMAGE_MIME_TYPES,
    "image/gif",
    ...INBOX_VIDEO_MIME_TYPES,
    ...INBOX_DOCUMENT_MIME_TYPES,
  ]);
  const allowedExt = new Set([
    ...IMAGE_EXTENSIONS,
    ".gif",
    ...INBOX_VIDEO_EXTENSIONS,
    ...INBOX_DOCUMENT_EXTENSIONS,
  ]);
  if (!kind || (!allowed.has(mime) && !allowedExt.has(ext))) {
    throw validationError("Envie imagem, vídeo MP4 ou documento (PDF, Word, Excel, TXT ou ZIP).");
  }
  const bytes = Buffer.from(await file.arrayBuffer());
  const filename = `${randomUUID()}${ext || ""}`;
  const relativeDir = `${prefix}/${Number(conversationId)}`;
  const mediaUrl = await saveBuffer(relativeDir, filename, bytes);
  const mediaType = mime || kind;
  return {
    kind,
    mediaUrl,
    mediaType,
    mimeType: mediaType,
    fileName: file.name || filename,
    relativePath: `${relativeDir}/${filename}`.replaceAll("\\", "/"),
    size: bytes.length,
  };
}

export async function saveInboxMediaBuffer(channelId, buffer, { mimeType, fileName, prefix = "inbox-in" } = {}) {
  if (!buffer?.length) return null;
  const ext = extFromName(fileName) || mimeToExt(mimeType);
  const filename = `${randomUUID()}${ext}`;
  const relativeDir = `${prefix}/${Number(channelId)}`;
  const mediaUrl = await saveBuffer(relativeDir, filename, Buffer.from(buffer));
  return {
    kind: inboxMediaKind(mimeType, null, fileName),
    mediaUrl,
    mediaType: mimeType || "application/octet-stream",
    fileName: fileName || filename,
    relativePath: `${relativeDir}/${filename}`.replaceAll("\\", "/"),
  };
}

function mimeToExt(mime) {
  const map = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
    "video/mp4": ".mp4",
    "video/3gpp": ".3gp",
    "application/pdf": ".pdf",
  };
  return map[String(mime || "").toLowerCase()] || "";
}
