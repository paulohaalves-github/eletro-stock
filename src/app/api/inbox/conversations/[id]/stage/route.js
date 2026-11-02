import { apiHandler, readJson } from "@/lib/api";
import { PERMISSIONS } from "@/lib/permissions";
import { updateConversationLeadStage } from "@/lib/services/inbox-conversations";
import { parseId } from "@/lib/validations";

export const POST = apiHandler(
  async (request, { params, session }) => {
    const { id } = await params;
    const body = await readJson(request);
    const conversation = await updateConversationLeadStage(parseId(id), body.stage, session, body);
    return { conversation, message: "Etapa comercial atualizada." };
  },
  { permission: PERMISSIONS.INBOX_REPLY },
);
