import { apiHandler } from "@/lib/api";
import { PERMISSIONS } from "@/lib/permissions";
import { getDashboard } from "@/lib/services/dashboard";

export const GET = apiHandler(
  async (request, { session }) => {
    const { searchParams } = new URL(request.url);
    return getDashboard(
      searchParams.get("period") || "30d",
      searchParams.get("from"),
      searchParams.get("to"),
      session,
    );
  },
  { permission: PERMISSIONS.DASHBOARD_VIEW },
);
