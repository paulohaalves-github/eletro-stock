import { apiHandler } from "@/lib/api";
import { PERMISSIONS } from "@/lib/permissions";
import { reopenConversation } from "@/lib/services/inbox-conversations";
import { parseId } from "@/lib/validations";

export const POST = apiHandler(
  async (_request, { params, session }) => {
    const { id } = await params;
    const conversation = await reopenConversation(parseId(id), session);
    return { conversation, message: "Conversa reaberta." };
  },
  { permission: PERMISSIONS.INBOX_REPLY },
);
