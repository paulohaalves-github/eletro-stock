import { apiHandler, readJson } from "@/lib/api";
import { getInboxChannelRecord, listUnofficialChannels, updateChannelConnection } from "@/lib/services/inbox-channels";
import { ingestIncomingMessage } from "@/lib/services/inbox-conversations";
import { INBOX_PROVIDERS } from "@/lib/constants";
import { validationError } from "@/lib/errors";
import { assertWorkerSecret } from "@/lib/whatsapp/worker-auth";
import { parseId } from "@/lib/validations";

export const dynamic = "force-dynamic";

export const GET = apiHandler(
  async (request) => {
    assertWorkerSecret(request);
    const items = await listUnofficialChannels();
    return { items };
  },
  { public: true },
);

export const POST = apiHandler(
  async (request) => {
    assertWorkerSecret(request);
    const body = await readJson(request);
    const channel = await getInboxChannelRecord(parseId(body.channelId));
    if (channel.provider !== INBOX_PROVIDERS.UNOFFICIAL) {
      throw validationError("Canal não é WhatsApp não oficial.");
    }
    const conversation = await ingestIncomingMessage({
      channel,
      from: body.from,
      pushName: body.pushName,
      body: body.body,
      externalId: body.externalId,
      timestamp: body.timestamp,
      mediaUrl: body.mediaUrl,
      mediaType: body.mediaType,
      fileName: body.fileName,
      jid: body.jid,
    });
    return { ok: true, conversationId: conversation.id };
  },
  { public: true },
);

export const PATCH = apiHandler(
  async (request) => {
    assertWorkerSecret(request);
    const body = await readJson(request);
    const channel = await updateChannelConnection(parseId(body.channelId), body);
    return { channel };
  },
  { public: true },
);
