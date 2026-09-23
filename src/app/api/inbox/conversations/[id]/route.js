import { apiHandler, readJson } from "@/lib/api";
import { PERMISSIONS } from "@/lib/permissions";
import { getConversation, linkConversationCustomer } from "@/lib/services/inbox-conversations";
import { parseId } from "@/lib/validations";
import { validationError } from "@/lib/errors";

export const GET = apiHandler(
  async (request, { params, session }) => {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const conversation = await getConversation(parseId(id), session, {
      markRead: searchParams.get("markRead") !== "0",
    });
    return { conversation };
  },
  { permission: PERMISSIONS.INBOX_VIEW },
);

export const PATCH = apiHandler(
  async (request, { params, session }) => {
    const { id } = await params;
    const body = await readJson(request);
    if (!body.customerId) throw validationError("Informe o cliente.");
    const conversation = await linkConversationCustomer(parseId(id), body.customerId, session);
    return { conversation, message: "Cliente vinculado à conversa." };
  },
  { permission: PERMISSIONS.INBOX_REPLY },
);
