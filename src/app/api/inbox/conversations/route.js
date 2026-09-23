import { apiHandler, readJson } from "@/lib/api";
import { PERMISSIONS } from "@/lib/permissions";
import { listConversations, startOutboundConversation } from "@/lib/services/inbox-conversations";

export const GET = apiHandler(
  async (request, { session }) => {
    const { searchParams } = new URL(request.url);
    return listConversations(
      {
        q: searchParams.get("q"),
        status: searchParams.get("status"),
        tab: searchParams.get("tab"),
        scope: searchParams.get("scope"),
        teamId: searchParams.get("teamId"),
        page: searchParams.get("page"),
        pageSize: searchParams.get("pageSize"),
      },
      session,
    );
  },
  { permission: PERMISSIONS.INBOX_VIEW },
);

export const POST = apiHandler(
  async (request, { session }) => {
    const body = await readJson(request);
    const conversation = await startOutboundConversation(body, session);
    return { conversation, message: "Mensagem enviada." };
  },
  { permission: PERMISSIONS.INBOX_REPLY },
);
