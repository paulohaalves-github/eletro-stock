import { apiHandler, readJson } from "@/lib/api";
import { PERMISSIONS } from "@/lib/permissions";
import { getInboxTeam, replaceInboxTeamMembers, updateInboxTeam } from "@/lib/services/inbox-teams";
import { parseId } from "@/lib/validations";

export const GET = apiHandler(
  async (_request, { params }) => {
    const { id } = await params;
    const team = await getInboxTeam(parseId(id));
    return { team };
  },
  { permission: PERMISSIONS.INBOX_VIEW },
);

export const PATCH = apiHandler(
  async (request, { params, session }) => {
    const { id } = await params;
    const body = await readJson(request);
    const team = await updateInboxTeam(parseId(id), body, session);
    return { team, message: "Equipe atualizada." };
  },
  { permission: PERMISSIONS.INBOX_TEAM_MANAGE },
);

export const PUT = apiHandler(
  async (request, { params, session }) => {
    const { id } = await params;
    const body = await readJson(request);
    const team = await replaceInboxTeamMembers(parseId(id), body.members, session);
    return { team, message: "Agentes atualizados." };
  },
  { permission: PERMISSIONS.INBOX_TEAM_MANAGE },
);
