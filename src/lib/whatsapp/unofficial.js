import { validationError } from "../errors";
import { normalizeWhatsAppPhone } from "../phone";

function workerUrl() {
  return String(process.env.WHATSAPP_WORKER_URL || "http://127.0.0.1:3010").replace(/\/$/, "");
}

function workerSecret() {
  return process.env.WHATSAPP_WORKER_SECRET || "";
}

async function workerRequest(path, payload) {
  const secret = workerSecret();
  if (!secret) {
    throw validationError("Configure WHATSAPP_WORKER_SECRET para usar o WhatsApp não oficial.");
  }
  let response;
  try {
    response = await fetch(`${workerUrl()}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-worker-secret": secret,
      },
      body: JSON.stringify(payload),
    });
  } catch {
    throw validationError("O worker do WhatsApp não oficial não está em execução.");
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw validationError(data.error || "Falha no worker do WhatsApp não oficial.");
  }
  return data;
}

export async function sendUnofficialMessage(channel, { to, body, jid, media }) {
  const phone = normalizeWhatsAppPhone(to);
  if (!phone) throw validationError("Telefone de destino inválido.");
  const result = await workerRequest("/send", {
    channelId: channel.id,
    to: phone,
    jid: jid || null,
    text: String(body || "").trim(),
    media: media
      ? {
          kind: media.kind,
          relativePath: media.relativePath,
          fileName: media.fileName,
          mimeType: media.mimeType || media.mediaType,
        }
      : null,
  });
  return { externalId: result.externalId || null, jid: result.jid || jid || null, raw: result };
}

export async function requestUnofficialQr(channelId) {
  return workerRequest("/connect", { channelId: Number(channelId) });
}

export async function logoutUnofficial(channelId) {
  return workerRequest("/logout", { channelId: Number(channelId) });
}
