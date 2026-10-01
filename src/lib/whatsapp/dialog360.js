import { readFile } from "node:fs/promises";
import { validationError } from "../errors";
import { normalizeWhatsAppPhone } from "../phone";
import { resolveUploadPath } from "../services/images";
import { saveInboxMediaBuffer } from "../services/inbox-media";

const DEFAULT_BASE_URL = "https://waba-v2.360dialog.io";

function baseUrl() {
  return String(process.env.DIALOG360_API_URL || DEFAULT_BASE_URL).replace(/\/$/, "");
}

export function dialog360Headers(apiKey) {
  return {
    "Content-Type": "application/json",
    "D360-API-KEY": apiKey,
  };
}

const templateCache = new Map();
const TEMPLATE_CACHE_MS = 60_000;

function normalizeDialog360Template(raw) {
  return {
    name: raw.name,
    language: raw.language || raw.language_code || "pt_BR",
    status: String(raw.status || "").toUpperCase(),
    category: raw.category || null,
    namespace: raw.namespace || null,
    components: Array.isArray(raw.components) ? raw.components : [],
    rejectedReason: raw.rejected_reason || null,
  };
}

export async function listDialog360Templates(channel, { force = false } = {}) {
  if (!channel?.apiKey) throw validationError("Canal 360dialog sem API key.");
  const cacheKey = Number(channel.id);
  const hit = templateCache.get(cacheKey);
  if (!force && hit && Date.now() - hit.at < TEMPLATE_CACHE_MS) return hit.items;

  const response = await fetch(`${baseUrl()}/v1/configs/templates?limit=1000`, {
    headers: { "D360-API-KEY": channel.apiKey },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw validationError(data?.error?.message || data?.message || "Não foi possível listar os modelos da 360dialog.");
  }
  const items = (data.waba_templates || data.data || data.templates || [])
    .map(normalizeDialog360Template)
    .filter((item) => item.name && ["APPROVED", "ACTIVE"].includes(item.status));
  templateCache.set(cacheKey, { at: Date.now(), items });
  return items;
}

async function uploadDialog360Media(channel, media) {
  const full = resolveUploadPath(media.relativePath);
  const bytes = await readFile(full);
  const form = new FormData();
  form.append("messaging_product", "whatsapp");
  const mimeType = media.mimeType || media.mediaType || "application/octet-stream";
  form.append("file", new Blob([new Uint8Array(bytes)], { type: mimeType }), media.fileName || "arquivo");
  form.append("type", mimeType);
  const response = await fetch(`${baseUrl()}/media`, {
    method: "POST",
    headers: { "D360-API-KEY": channel.apiKey },
    body: form,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.id) {
    throw validationError(data?.error?.message || data?.message || "Não foi possível enviar a mídia para a 360dialog.");
  }
  return data.id;
}

function dialog360MediaDownloadUrl(url) {
  if (!url) return null;
  try {
    const parsed = new URL(String(url).replaceAll("\\", ""));
    if (parsed.hostname.includes("lookaside.")) {
      const host = new URL(baseUrl());
      parsed.protocol = host.protocol;
      parsed.host = host.host;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

async function readDialog360Error(response) {
  const text = await response.text().catch(() => "");
  try {
    const data = JSON.parse(text);
    return data?.error?.message || data?.message || text.slice(0, 200);
  } catch {
    return text.slice(0, 200);
  }
}

async function fetchDialog360Binary(url, apiKey) {
  const downloadUrl = dialog360MediaDownloadUrl(url);
  if (!downloadUrl) throw new Error("URL de mídia 360dialog inválida.");
  const response = await fetch(downloadUrl, {
    headers: { "D360-API-KEY": apiKey },
    redirect: "follow",
  });
  if (!response.ok) {
    throw new Error(`Falha ao baixar mídia 360dialog (${response.status}): ${await readDialog360Error(response)}`);
  }
  const type = response.headers.get("content-type") || "";
  if (type.includes("application/json")) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data?.error?.message || data?.message || "A 360dialog devolveu JSON em vez do arquivo.");
  }
  return {
    buffer: Buffer.from(await response.arrayBuffer()),
    mimeType: type || null,
  };
}

export async function downloadDialog360Media(channel, { mediaId, mediaUrl, mediaType, fileName, mimeType } = {}) {
  if (!channel.apiKey || (!mediaId && !mediaUrl)) return null;
  const headers = { "D360-API-KEY": channel.apiKey };
  let buffer;
  let resolvedMime = mimeType || null;

  if (mediaUrl) {
    try {
      const file = await fetchDialog360Binary(mediaUrl, channel.apiKey);
      buffer = file.buffer;
      resolvedMime = resolvedMime || file.mimeType;
    } catch (error) {
      if (!mediaId) throw error;
      console.error("[360dialog-media]", "URL do webhook falhou, tentando media-id", error.message || error);
    }
  }

  if (!buffer && mediaId) {
    const response = await fetch(`${baseUrl()}/${mediaId}`, {
      headers,
      redirect: "follow",
    });
    if (!response.ok) {
      throw new Error(`Falha ao obter URL da mídia 360dialog (${response.status}): ${await readDialog360Error(response)}`);
    }
    const type = response.headers.get("content-type") || "";
    if (type.includes("application/json")) {
      const data = await response.json().catch(() => ({}));
      resolvedMime = resolvedMime || data.mime_type || null;
      const url = data.url || data.media_url;
      if (!url) throw new Error("A 360dialog não retornou a URL da mídia.");
      const file = await fetchDialog360Binary(url, channel.apiKey);
      buffer = file.buffer;
      resolvedMime = resolvedMime || file.mimeType;
    } else {
      buffer = Buffer.from(await response.arrayBuffer());
      resolvedMime = resolvedMime || type;
    }
  }

  if (!buffer?.length) return null;

  return saveInboxMediaBuffer(channel.id, buffer, {
    mimeType: resolvedMime || mediaType || "application/octet-stream",
    fileName: fileName || `whatsapp-${mediaId || "media"}`,
  });
}

export async function sendDialog360Message(channel, { to, body, media, templateName, templateLanguage, templateComponents, quotedExternalId }) {
  if (!channel.apiKey) throw validationError("Canal 360dialog sem API key.");
  const phone = normalizeWhatsAppPhone(to);
  if (!phone) throw validationError("Telefone de destino inválido.");

  let payload;
  if (media?.relativePath) {
    const mediaId = await uploadDialog360Media(channel, media);
    const type = media.kind === "video" ? "video" : media.kind === "image" ? "image" : "document";
    payload = {
      messaging_product: "whatsapp",
      to: phone,
      type,
      [type]: {
        id: mediaId,
        ...(body ? { caption: body } : {}),
        ...(type === "document" ? { filename: media.fileName || "arquivo" } : {}),
      },
    };
  } else if (templateName) {
    payload = {
      messaging_product: "whatsapp",
      to: phone,
      type: "template",
      template: {
        name: templateName,
        language: { code: templateLanguage || "pt_BR" },
        ...(templateComponents?.length ? { components: templateComponents } : {}),
      },
    };
  } else {
    payload = {
      messaging_product: "whatsapp",
      to: phone,
      type: "text",
      text: { body: String(body || "").trim(), preview_url: false },
    };
  }

  if (quotedExternalId && payload.type !== "template") {
    payload.context = { message_id: String(quotedExternalId) };
  }

  const response = await fetch(`${baseUrl()}/messages`, {
    method: "POST",
    headers: dialog360Headers(channel.apiKey),
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      data?.error?.message ||
      data?.message ||
      data?.meta?.developer_message ||
      "A 360dialog recusou o envio da mensagem.";
    throw validationError(message);
  }
  return {
    externalId: data?.messages?.[0]?.id || data?.message_id || null,
    raw: data,
  };
}

export function extractDialog360Events(payload) {
  const events = [];
  const entries = payload?.entry || (payload?.messages || payload?.statuses ? [{ changes: [{ value: payload }] }] : []);
  for (const entry of entries) {
    for (const change of entry.changes || []) {
      const value = change.value || {};
      const metadata = value.metadata || {};
      const contacts = new Map(
        (value.contacts || []).map((contact) => [contact.wa_id, contact.profile?.name || null]),
      );
      for (const message of value.messages || []) {
        const media = messageMedia(message);
        events.push({
          kind: "message",
          phoneNumberId: metadata.phone_number_id || null,
          displayPhone: metadata.display_phone_number || null,
          from: message.from,
          pushName: contacts.get(message.from) || null,
          externalId: message.id,
          timestamp: message.timestamp,
          type: message.type,
          body: messageText(message),
          mediaId: media.mediaId,
          mediaUrl: media.mediaUrl,
          fileName: media.fileName,
          mimeType: media.mimeType,
          mediaType: media.mimeType || message.type,
          quotedExternalId: message.context?.id || message.context?.message_id || null,
        });
      }
      for (const status of value.statuses || []) {
        events.push({
          kind: "status",
          phoneNumberId: metadata.phone_number_id || null,
          displayPhone: metadata.display_phone_number || null,
          externalId: status.id,
          status: String(status.status || "").toUpperCase(),
          timestamp: status.timestamp,
        });
      }
    }
  }
  return events;
}

function messageMedia(message) {
  const block = message.image || message.sticker || message.audio || message.video || message.document || null;
  if (!block) return { mediaId: null, mediaUrl: null, fileName: null, mimeType: null };
  return {
    mediaId: block.id || null,
    mediaUrl: block.url || block.link || null,
    fileName: block.filename || block.file_name || null,
    mimeType: block.mime_type || block.mimeType || null,
  };
}

function messageText(message) {
  if (message.type === "text") return message.text?.body || "";
  if (message.type === "button") return message.button?.text || message.button?.payload || "[Botão]";
  if (message.type === "interactive") {
    return message.interactive?.button_reply?.title || message.interactive?.list_reply?.title || "[Interativo]";
  }
  const caption = message.image?.caption || message.video?.caption || message.document?.caption;
  const labels = {
    image: "[Imagem]",
    audio: "[Áudio]",
    video: "[Vídeo]",
    document: "[Documento]",
    sticker: "[Figurinha]",
    location: "[Localização]",
    contacts: "[Contato]",
  };
  const label = labels[message.type] || `[${message.type || "Mensagem"}]`;
  return caption ? `${label} ${caption}` : label;
}
