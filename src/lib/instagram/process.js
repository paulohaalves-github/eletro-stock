import { INBOX_PROVIDERS } from "../constants";
import { saveInboxMediaBuffer } from "../services/inbox-media";
import { findChannelForInstagram } from "../services/inbox-channels";
import { ingestIncomingMessage, updateMessageStatus } from "../services/inbox-conversations";
import { fetchInstagramProfile, instagramContactName } from "./graph";

const MEDIA_EXT = {
  image: ".jpg",
  video: ".mp4",
  audio: ".m4a",
  file: ".bin",
};

function attachmentFile(attachment) {
  const type = String(attachment?.type || "file");
  const url = attachment?.payload?.url || "";
  if (!url) return null;
  return {
    url,
    mediaType: type,
    fileName: `${type}${MEDIA_EXT[type] || ".bin"}`,
  };
}

export function extractInstagramEvents(payload) {
  if (payload?.object !== "instagram") return [];
  const events = [];
  for (const entry of payload.entry || []) {
    const igUserId = entry?.id ? String(entry.id) : "";
    for (const item of entry.messaging || []) {
      const senderId = item?.sender?.id ? String(item.sender.id) : "";
      const timestamp = item.timestamp || entry.time || null;
      if (item.read?.mid) {
        events.push({ kind: "status", igUserId, externalId: String(item.read.mid), status: "READ", timestamp });
        continue;
      }
      const message = item.message;
      if (!message?.mid || message.is_echo || message.is_deleted) continue;
      if (!senderId || senderId === igUserId) continue;
      const attachment = Array.isArray(message.attachments) ? message.attachments[0] : null;
      const file = attachmentFile(attachment);
      let body = String(message.text || "").trim();
      if (!body && message.is_unsupported) body = "Mensagem não suportada pelo Instagram.";
      if (!body && attachment?.type === "story_mention") body = "[Menção no story]";
      if (!body && attachment?.type === "ig_reel") body = "[Reels]";
      if (!body && attachment?.type === "share") body = "[Compartilhamento]";
      events.push({
        kind: "message",
        igUserId,
        senderId,
        externalId: String(message.mid),
        body,
        timestamp,
        file,
        quotedExternalId: message.reply_to?.mid ? String(message.reply_to.mid) : null,
      });
    }
  }
  return events;
}

async function downloadInstagramMedia(channel, file) {
  const response = await fetch(file.url);
  if (!response.ok) return null;
  const buffer = Buffer.from(await response.arrayBuffer());
  if (!buffer.length || buffer.length > 16 * 1024 * 1024) return null;
  const mimeType = String(response.headers.get("content-type") || file.mediaType || "application/octet-stream").split(";")[0];
  return saveInboxMediaBuffer(channel.id, buffer, { mimeType, fileName: file.fileName });
}

export async function processInstagramWebhook(payload) {
  const events = extractInstagramEvents(payload);
  let processed = 0;
  for (const event of events) {
    const channel = await findChannelForInstagram(event.igUserId);
    if (!channel) continue;
    if (event.kind === "status") {
      await updateMessageStatus(event.externalId, event.status, event.timestamp);
      processed += 1;
      continue;
    }
    let mediaUrl = null;
    let mediaType = null;
    let fileName = null;
    if (event.file) {
      try {
        const saved = await downloadInstagramMedia(channel, event.file);
        if (saved) {
          mediaUrl = saved.mediaUrl;
          mediaType = saved.mediaType;
          fileName = saved.fileName;
        }
      } catch (error) {
        console.error("[instagram-media]", error.message || error);
      }
    }
    const profile = await fetchInstagramProfile(channel, event.senderId);
    await ingestIncomingMessage({
      channel,
      from: event.senderId,
      externalContactId: event.senderId,
      pushName: instagramContactName(profile),
      body: event.body,
      externalId: event.externalId,
      timestamp: event.timestamp,
      mediaUrl,
      mediaType,
      fileName,
      quotedExternalId: event.quotedExternalId,
    });
    processed += 1;
  }
  return { processed, provider: INBOX_PROVIDERS.META_INSTAGRAM };
}
