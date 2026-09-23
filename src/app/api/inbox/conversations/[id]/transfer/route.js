import { apiHandler, readJson } from "@/lib/api";
import { PERMISSIONS } from "@/lib/permissions";
import { transferConversation } from "@/lib/services/inbox-conversations";
import { parseId } from "@/lib/validations";

export const POST = apiHandler(
  async (request, { params, session }) => {
    const { id } = await params;
    const body = await readJson(request);
    const conversation = await transferConversation(parseId(id), body, session);
    return { conversation, message: "Conversa transferida." };
  },
  { permission: PERMISSIONS.INBOX_ASSIGN },
);
