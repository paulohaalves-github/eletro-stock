/**
 * Worker do WhatsApp não oficial (sessão Web no próprio servidor).
 * Rode em paralelo ao Next.js: npm run whatsapp:worker
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const uploadDir = process.env.UPLOAD_DIR || "uploads";
const port = Number(process.env.WHATSAPP_WORKER_PORT || 3010);
const secret = process.env.WHATSAPP_WORKER_SECRET || "";
const appUrl = String(process.env.WHATSAPP_APP_URL || "http://127.0.0.1:3000").replace(/\/$/, "");

const sockets = new Map();

function sessionDir(channelId) {
  return path.join(rootDir, uploadDir, "whatsapp-sessions", String(channelId));
}

function json(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(payload);
}

function unauthorized(res) {
  json(res, 401, { error: "Segredo do worker inválido." });
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"));
      } catch {
        resolve({});
      }
    });
    req.on("error", reject);
  });
}

function isLidJid(jid) {
  return String(jid || "").includes("@lid");
}

function isPnJid(jid) {
  return String(jid || "").includes("@s.whatsapp.net");
}

function jidUser(jid) {
  return String(jid || "").split("@")[0].split(":")[0];
}

function phoneFromPnJid(jid) {
  if (!jid || isLidJid(jid)) return "";
  return jidUser(jid).replace(/\D/g, "");
}

function mediaMeta(content) {
  if (content.imageMessage) return { kind: "image", mime: content.imageMessage.mimetype, fileName: "imagem.jpg" };
  if (content.videoMessage) return { kind: "video", mime: content.videoMessage.mimetype, fileName: "video.mp4" };
  if (content.documentMessage) {
    return {
      kind: "document",
      mime: content.documentMessage.mimetype,
      fileName: content.documentMessage.fileName || "documento",
    };
  }
  if (content.audioMessage) return { kind: "audio", mime: content.audioMessage.mimetype, fileName: "audio.ogg" };
  return null;
}

async function saveInboundMedia(sock, message, channelId) {
  const content = unwrapContent(message);
  const meta = mediaMeta(content);
  if (!meta) return null;
  try {
    const baileys = await import("@whiskeysockets/baileys");
    const downloadMediaMessage = baileys.downloadMediaMessage;
    const buffer = await downloadMediaMessage(message, "buffer", {});
    if (!buffer?.length) return { mediaType: meta.kind, fileName: meta.fileName };
    const ext = path.extname(meta.fileName) || "";
    const filename = `${Date.now()}-${Math.random().toString(16).slice(2)}${ext}`;
    const relDir = path.join("inbox-in", String(channelId));
    fs.mkdirSync(path.join(rootDir, uploadDir, relDir), { recursive: true });
    fs.writeFileSync(path.join(rootDir, uploadDir, relDir, filename), buffer);
    return {
      mediaUrl: `/api/files/${relDir.replaceAll("\\", "/")}/${filename}`,
      mediaType: meta.mime || meta.kind,
      fileName: meta.fileName,
    };
  } catch (error) {
    console.warn(`[whatsapp] mídia inbound canal ${channelId}:`, error.message);
    return { mediaType: meta.kind, fileName: meta.fileName };
  }
}

function unwrapContent(message) {
  let content = message?.message || {};
  const wrappers = [
    "ephemeralMessage",
    "viewOnceMessage",
    "viewOnceMessageV2",
    "viewOnceMessageV2Extension",
    "documentWithCaptionMessage",
    "editedMessage",
  ];
  for (const key of wrappers) {
    if (content[key]?.message) content = content[key].message;
  }
  return content;
}

function extractText(message) {
  const content = unwrapContent(message);
  return (
    content.conversation ||
    content.extendedTextMessage?.text ||
    content.imageMessage?.caption ||
    content.videoMessage?.caption ||
    content.documentMessage?.caption ||
    (content.imageMessage ? "[Imagem]" : "") ||
    (content.audioMessage ? "[Áudio]" : "") ||
    (content.videoMessage ? "[Vídeo]" : "") ||
    (content.documentMessage ? "[Documento]" : "") ||
    (content.stickerMessage ? "[Figurinha]" : "") ||
    (content.reactionMessage ? "" : "") ||
    ""
  );
}

function extractPeer(message) {
  const key = message.key || {};
  const remoteJid = key.remoteJid || "";
  const phone = phoneFromPnJid(key.senderPn)
    || phoneFromPnJid(key.participantPn)
    || (isPnJid(remoteJid) ? phoneFromPnJid(remoteJid) : "");
  return { jid: remoteJid, phone };
}

function phoneVariants(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  const variants = [digits];
  if (digits.startsWith("55") && digits.length === 13) {
    variants.push(`${digits.slice(0, 4)}${digits.slice(5)}`);
  }
  if (digits.startsWith("55") && digits.length === 12) {
    variants.push(`${digits.slice(0, 4)}9${digits.slice(4)}`);
  }
  return [...new Set(variants.filter(Boolean))];
}

async function resolveSendJid(sock, phone, preferredJid) {
  if (preferredJid) return preferredJid;
  for (const digits of phoneVariants(phone)) {
    const pnJid = `${digits}@s.whatsapp.net`;
    try {
      const results = await sock.onWhatsApp(pnJid);
      const hit = (results || []).find((item) => item?.exists || item?.jid || item?.lid);
      if (hit?.lid) return String(hit.lid).includes("@") ? String(hit.lid) : `${hit.lid}@lid`;
      if (hit?.jid) return hit.jid;
    } catch (error) {
      console.warn("[whatsapp] onWhatsApp falhou:", error.message);
    }
  }
  const digits = String(phone || "").replace(/\D/g, "");
  return `${digits}@s.whatsapp.net`;
}

async function waitForReady(channelId, timeoutMs = 20000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const entry = sockets.get(Number(channelId));
    if (entry?.sock && entry.ready) return entry;
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  throw new Error("Canal não está conectado no worker. Confira se o processo npm run whatsapp:worker está no ar.");
}

async function appRequest(method, pathname, body) {
  const response = await fetch(`${appUrl}${pathname}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "x-worker-secret": secret,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || `Falha ao falar com o Eletro-Stock (${response.status}).`);
  }
  return data;
}

async function patchChannel(channelId, payload) {
  return appRequest("PATCH", "/api/integrations/whatsapp/unofficial", { channelId, ...payload });
}

async function startSession(channelId, { forceQr = false } = {}) {
  const existing = sockets.get(Number(channelId));
  if (existing?.sock) {
    if (forceQr) {
      try {
        await existing.sock.logout();
      } catch {
        // ignore
      }
      sockets.delete(Number(channelId));
    } else {
      return existing;
    }
  }

  let makeWASocket;
  let useMultiFileAuthState;
  let DisconnectReason;
  let fetchLatestBaileysVersion;
  let QRCode;
  try {
    ({ default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = await import("@whiskeysockets/baileys"));
    if (!makeWASocket) {
      const mod = await import("@whiskeysockets/baileys");
      makeWASocket = mod.makeWASocket || mod.default;
    }
    QRCode = (await import("qrcode")).default;
  } catch {
    throw new Error("Instale @whiskeysockets/baileys e qrcode para o WhatsApp não oficial.");
  }

  const dir = sessionDir(channelId);
  fs.mkdirSync(dir, { recursive: true });
  const { state, saveCreds } = await useMultiFileAuthState(dir);
  const { version } = await fetchLatestBaileysVersion();
  const sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: false,
    syncFullHistory: false,
    markOnlineOnConnect: true,
    emitOwnEvents: false,
  });

  const entry = { sock, ready: false };
  sockets.set(Number(channelId), entry);

  sock.ev.on("creds.update", saveCreds);
  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, qr } = update;
    try {
      if (qr) {
        const qrPayload = await QRCode.toDataURL(qr);
        await patchChannel(channelId, { connectionStatus: "QR_PENDING", qrPayload, connectionError: null });
      }
      if (connection === "open") {
        entry.ready = true;
        const phone = phoneFromPnJid(sock.user?.id) || jidUser(sock.user?.id).replace(/\D/g, "");
        await patchChannel(channelId, {
          connectionStatus: "CONNECTED",
          qrPayload: null,
          connectionError: null,
          phoneNumber: phone || undefined,
        });
        console.log(`[whatsapp] canal ${channelId} conectado`);
      }
      if (connection === "close") {
        entry.ready = false;
        const status = lastDisconnect?.error?.output?.statusCode;
        const loggedOut = status === DisconnectReason.loggedOut;
        sockets.delete(Number(channelId));
        if (loggedOut) {
          await patchChannel(channelId, {
            connectionStatus: "DISCONNECTED",
            qrPayload: null,
            connectionError: "Sessão encerrada no celular.",
          });
          return;
        }
        await patchChannel(channelId, {
          connectionStatus: "QR_PENDING",
          connectionError: lastDisconnect?.error?.message || "Reconectando...",
        });
        setTimeout(() => {
          startSession(channelId).catch((error) => console.error(error.message));
        }, 3000);
      }
    } catch (error) {
      console.error(`[whatsapp] canal ${channelId}:`, error.message);
    }
  });

  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify" && type !== "append") return;
    for (const message of messages || []) {
      if (message.key?.fromMe || message.key?.remoteJid === "status@broadcast") continue;
      if (String(message.key?.remoteJid || "").endsWith("@g.us")) continue;
      const content = unwrapContent(message);
      if (!content || Object.keys(content).length === 0) continue;
      const body = extractText(message);
      const media = await saveInboundMedia(sock, message, channelId);
      if (!body && !media) continue;
      const peer = extractPeer(message);
      let jid = peer.jid;
      let phone = peer.phone;
      if (phone) {
        try {
          const resolved = await resolveSendJid(sock, phone, null);
          if (resolved) jid = resolved;
        } catch {
          // keep original jid
        }
      }
      if (!phone && !jid) {
        console.warn(`[whatsapp] inbound canal ${channelId} sem telefone e sem jid`);
        continue;
      }
      try {
        await appRequest("POST", "/api/integrations/whatsapp/unofficial", {
          channelId: Number(channelId),
          from: phone,
          jid,
          pushName: message.pushName,
          body,
          mediaUrl: media?.mediaUrl,
          mediaType: media?.mediaType,
          fileName: media?.fileName,
          externalId: message.key.id,
          timestamp: message.messageTimestamp,
        });
      } catch (error) {
        console.error(`[whatsapp] inbound canal ${channelId}:`, error.message);
      }
    }
  });

  return entry;
}

function safeUploadPath(relativePath) {
  const root = path.resolve(rootDir, uploadDir);
  const full = path.resolve(root, String(relativePath || ""));
  if (!full.startsWith(root)) throw new Error("Caminho de arquivo inválido.");
  return full;
}

async function sendMessage(channelId, to, text, jid, media) {
  const entry = await waitForReady(channelId);
  const dest = await resolveSendJid(entry.sock, to, jid);
  console.log(`[whatsapp] enviando canal ${channelId} para ${dest}`);
  let content;
  if (media?.relativePath) {
    const buffer = fs.readFileSync(safeUploadPath(media.relativePath));
    const caption = String(text || "") || undefined;
    if (media.kind === "image") content = { image: buffer, caption };
    else if (media.kind === "video") content = { video: buffer, caption };
    else {
      content = {
        document: buffer,
        mimetype: media.mimeType || "application/octet-stream",
        fileName: media.fileName || "arquivo",
        caption,
      };
    }
  } else {
    content = { text: String(text || "") };
  }
  const sent = await entry.sock.sendMessage(dest, content);
  return { externalId: sent?.key?.id || null, jid: dest };
}

async function logout(channelId) {
  const entry = sockets.get(Number(channelId));
  if (entry?.sock) {
    try {
      await entry.sock.logout();
    } catch {
      // ignore
    }
    sockets.delete(Number(channelId));
  }
  const dir = sessionDir(channelId);
  fs.rmSync(dir, { recursive: true, force: true });
}

const server = http.createServer(async (req, res) => {
  if (req.headers["x-worker-secret"] !== secret || !secret) {
    unauthorized(res);
    return;
  }
  try {
    if (req.method === "GET" && req.url === "/health") {
      json(res, 200, { ok: true, channels: [...sockets.keys()] });
      return;
    }
    const body = req.method === "GET" ? {} : await readBody(req);
    if (req.method === "POST" && req.url === "/connect") {
      await startSession(body.channelId, { forceQr: false });
      json(res, 200, { ok: true });
      return;
    }
    if (req.method === "POST" && req.url === "/send") {
      const result = await sendMessage(body.channelId, body.to, body.text, body.jid, body.media);
      json(res, 200, result);
      return;
    }
    if (req.method === "POST" && req.url === "/logout") {
      await logout(body.channelId);
      json(res, 200, { ok: true });
      return;
    }
    json(res, 404, { error: "Rota do worker não encontrada." });
  } catch (error) {
    json(res, 400, { error: error.message || "Falha no worker." });
  }
});

async function resumeSessions() {
  try {
    const data = await appRequest("GET", "/api/integrations/whatsapp/unofficial");
    for (const channel of data.items || []) {
      const dir = sessionDir(channel.id);
      const hasSession = fs.existsSync(path.join(dir, "creds.json"));
      if (hasSession || channel.connectionStatus === "QR_PENDING" || channel.connectionStatus === "CONNECTED") {
        await startSession(channel.id).catch((error) => console.error(error.message));
      }
    }
  } catch (error) {
    console.warn("[whatsapp] Eletro-Stock indisponível na largada:", error.message);
  }
}

if (!secret) {
  console.warn("[whatsapp] WHATSAPP_WORKER_SECRET não definido. O worker recusará chamadas.");
}

server.listen(port, "127.0.0.1", () => {
  console.log(`[whatsapp] worker em http://127.0.0.1:${port}`);
  void resumeSessions();
});
