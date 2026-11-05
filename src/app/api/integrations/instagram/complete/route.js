import { apiHandler, readJson } from "@/lib/api";
import { completePendingInstagramAccount } from "@/lib/instagram/accounts";
import { PERMISSIONS } from "@/lib/permissions";
import { parseId } from "@/lib/validations";

export const POST = apiHandler(
  async (request, { session }) => {
    const body = await readJson(request);
    await completePendingInstagramAccount(parseId(body.channelId), body.igUserId, session);
    return { ok: true, message: "Instagram conectado." };
  },
  { permission: PERMISSIONS.INBOX_CHANNEL_MANAGE },
);
