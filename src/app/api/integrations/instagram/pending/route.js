import { apiHandler } from "@/lib/api";
import { listPendingInstagramAccounts } from "@/lib/instagram/accounts";
import { PERMISSIONS } from "@/lib/permissions";
import { parseId } from "@/lib/validations";

export const dynamic = "force-dynamic";

export const GET = apiHandler(
  async (request) => {
    const channelId = parseId(new URL(request.url).searchParams.get("channelId"));
    const accounts = await listPendingInstagramAccounts(channelId);
    return { channelId, accounts };
  },
  { permission: PERMISSIONS.INBOX_CHANNEL_MANAGE },
);
