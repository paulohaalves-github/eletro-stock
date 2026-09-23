import { apiHandler } from "@/lib/api";
import { PERMISSIONS } from "@/lib/permissions";
import { getInboxDashboard } from "@/lib/services/inbox-dashboard";

export const GET = apiHandler(
  async (request, { session }) => {
    const { searchParams } = new URL(request.url);
    return getInboxDashboard(session, {
      period: searchParams.get("period") || "all",
      rangeType: searchParams.get("rangeType") || "started",
      from: searchParams.get("from"),
      to: searchParams.get("to"),
      channelId: searchParams.get("channelId"),
    });
  },
  { permission: PERMISSIONS.INBOX_VIEW },
);
