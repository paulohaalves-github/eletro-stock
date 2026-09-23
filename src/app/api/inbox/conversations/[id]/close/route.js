import { apiHandler } from "@/lib/api";
import { PERMISSIONS } from "@/lib/permissions";
import { closeConversation } from "@/lib/services/inbox-conversations";
import { parseId } from "@/lib/validations";

export const POST = apiHandler(
  async (_request, { params, session }) => {
    const { id } = await params;
    const conversation = await closeConversation(parseId(id), session);
    return { conversation, message: "Conversa encerrada." };
  },
  { permission: PERMISSIONS.INBOX_REPLY },
);
