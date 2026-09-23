import { apiHandler, readJson } from "@/lib/api";
import { PERMISSIONS } from "@/lib/permissions";
import { getInboxChannel, updateInboxChannel } from "@/lib/services/inbox-channels";
import { parseId } from "@/lib/validations";

export const GET = apiHandler(
  async (request, { params }) => {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const channel = await getInboxChannel(parseId(id), { includeQr: searchParams.get("qr") === "1" });
    return { channel };
  },
  { permission: PERMISSIONS.INBOX_VIEW },
);

export const PATCH = apiHandler(
  async (request, { params, session }) => {
    const { id } = await params;
    const body = await readJson(request);
    const channel = await updateInboxChannel(parseId(id), body, session);
    return { channel, message: "Canal atualizado." };
  },
  { permission: PERMISSIONS.INBOX_CHANNEL_MANAGE },
);
