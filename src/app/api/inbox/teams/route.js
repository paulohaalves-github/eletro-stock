import { apiHandler, readJson } from "@/lib/api";
import { PERMISSIONS } from "@/lib/permissions";
import { createInboxTeam, listInboxTeams } from "@/lib/services/inbox-teams";

export const GET = apiHandler(
  async (request) => {
    const { searchParams } = new URL(request.url);
    return listInboxTeams({
      q: searchParams.get("q"),
      active: searchParams.get("active"),
      page: searchParams.get("page"),
      pageSize: searchParams.get("pageSize"),
    });
  },
  { permission: PERMISSIONS.INBOX_VIEW },
);

export const POST = apiHandler(
  async (request, { session }) => {
    const body = await readJson(request);
    const team = await createInboxTeam(body, session);
    return { team, message: "Equipe cadastrada." };
  },
  { permission: PERMISSIONS.INBOX_TEAM_MANAGE },
);
