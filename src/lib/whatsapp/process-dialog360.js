import { prisma } from "@/lib/db";
import { INBOX_PROVIDERS } from "@/lib/constants";
import { findChannelForDialog360 } from "@/lib/services/inbox-channels";
import { ingestIncomingMessage, updateMessageStatus } from "@/lib/services/inbox-conversations";
import { extractDialog360Events, downloadDialog360Media } from "@/lib/whatsapp/dialog360";

export async function processDialog360Webhook(payload, channelId) {
  const events = extractDialog360Events(payload);
  let processed = 0;
  for (const event of events) {
    const channel = await findChannelForDialog360({
      channelId,
      phoneNumberId: event.phoneNumberId,
      displayPhone: event.displayPhone,
    });
    if (!channel) continue;
    if (event.phoneNumberId && !channel.externalId) {
      await prisma.inboxChannel.update({
        where: { id: channel.id },
        data: { externalId: String(event.phoneNumberId) },
      });
    }
    if (event.kind === "message") {
      let mediaUrl = null;
      let fileName = null;
      let mediaType = event.mediaType;
      if (event.mediaId && event.mediaType && event.mediaType !== "text") {
        const saved = await downloadDialog360Media(channel, event.mediaId, event.mediaType).catch(() => null);
        if (saved) {
          mediaUrl = saved.mediaUrl;
          fileName = saved.fileName;
          mediaType = saved.mediaType || event.mediaType;
        }
      }
      await ingestIncomingMessage({
        channel,
        from: event.from,
        pushName: event.pushName,
        body: event.body,
        externalId: event.externalId,
        timestamp: event.timestamp,
        mediaUrl,
        mediaType,
        fileName,
      });
      processed += 1;
    } else if (event.kind === "status") {
      await updateMessageStatus(event.externalId, event.status, event.timestamp);
      processed += 1;
    }
  }
  return { processed, provider: INBOX_PROVIDERS.DIALOG_360 };
}
