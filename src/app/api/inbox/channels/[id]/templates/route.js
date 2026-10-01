import { apiHandler } from "@/lib/api";
import { PERMISSIONS } from "@/lib/permissions";
import { listChannelTemplates } from "@/lib/services/inbox-templates";
import { parseId } from "@/lib/validations";

export const GET = apiHandler(
  async (_request, { params, session }) => {
    const { id } = await params;
    const items = await listChannelTemplates(parseId(id), session);
    return { items };
  },
  { permission: PERMISSIONS.INBOX_REPLY },
);
