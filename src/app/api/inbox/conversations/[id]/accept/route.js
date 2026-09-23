import { apiHandler } from "@/lib/api";
import { PERMISSIONS } from "@/lib/permissions";
import { acceptConversation } from "@/lib/services/inbox-conversations";
import { parseId } from "@/lib/validations";

export const POST = apiHandler(
  async (_request, { params, session }) => {
    const { id } = await params;
    const conversation = await acceptConversation(parseId(id), session);
    return { conversation, message: "Conversa aceita." };
  },
  { permission: PERMISSIONS.INBOX_REPLY },
);
