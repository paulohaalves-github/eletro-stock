import { apiHandler } from "@/lib/api";
import { PERMISSIONS } from "@/lib/permissions";
import { listLeadBoard } from "@/lib/services/lead-stages";

export const GET = apiHandler(
  async (request, { session }) => {
    const { searchParams } = new URL(request.url);
    return listLeadBoard({
      q: searchParams.get("q"),
      teamId: searchParams.get("teamId"),
    }, session);
  },
  { permission: PERMISSIONS.INBOX_VIEW },
);
