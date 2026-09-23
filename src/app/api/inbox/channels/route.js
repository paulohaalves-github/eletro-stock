import { apiHandler, readJson } from "@/lib/api";
import { PERMISSIONS } from "@/lib/permissions";
import { createInboxChannel, listInboxChannels } from "@/lib/services/inbox-channels";

export const GET = apiHandler(
  async (request, { session }) => {
    const { searchParams } = new URL(request.url);
    return listInboxChannels({
      q: searchParams.get("q"),
      page: searchParams.get("page"),
      pageSize: searchParams.get("pageSize"),
      outbound: searchParams.get("outbound") === "1",
      session,
    });
  },
  { permission: PERMISSIONS.INBOX_VIEW },
);

export const POST = apiHandler(
  async (request, { session }) => {
    const body = await readJson(request);
    const channel = await createInboxChannel(body, session);
    return { channel, message: "Canal cadastrado." };
  },
  { permission: PERMISSIONS.INBOX_CHANNEL_MANAGE },
);
