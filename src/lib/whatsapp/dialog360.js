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

export async function downloadDialog360Media(channel, mediaId, mediaType) {
  if (!channel.apiKey || !mediaId) return null;
  const response = await fetch(`${baseUrl()}/${mediaId}`, {
    headers: { "D360-API-KEY": channel.apiKey },
    redirect: "follow",
  });
  if (!response.ok) return null;
  const type = response.headers.get("content-type") || "";
  let buffer;
  let mimeType = type;
  if (type.includes("application/json")) {
    const data = await response.json().catch(() => ({}));
    const url = data.url || data.media_url;
    if (!url) return null;
    const bin = await fetch(url, { headers: { "D360-API-KEY": channel.apiKey } });
    if (!bin.ok) return null;
    buffer = Buffer.from(await bin.arrayBuffer());
    mimeType = bin.headers.get("content-type") || mediaType || "application/octet-stream";
  } else {
    buffer = Buffer.from(await response.arrayBuffer());
  }
  return saveInboxMediaBuffer(channel.id, buffer, {
    mimeType,
    fileName: `whatsapp-${mediaId}`,
  });
}

export async function sendDialog360Message(channel, { to, body, media, templateName, templateLanguage, templateComponents }) {
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
        ...(templateComponents ? { components: templateComponents } : {}),
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
          mediaId: message.image?.id || message.audio?.id || message.document?.id || message.video?.id || null,
          mediaType: message.type,
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
