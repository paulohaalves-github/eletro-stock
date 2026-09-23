import { apiHandler } from "@/lib/api";
import { PERMISSIONS } from "@/lib/permissions";
import { listInboxUsers } from "@/lib/services/inbox-teams";

export const GET = apiHandler(
  async (request) => {
    const { searchParams } = new URL(request.url);
    return listInboxUsers({ q: searchParams.get("q") });
  },
  { permission: PERMISSIONS.INBOX_TEAM_MANAGE },
);
