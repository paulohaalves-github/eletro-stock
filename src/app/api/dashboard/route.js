import { apiHandler } from "@/lib/api";
import { PERMISSIONS } from "@/lib/permissions";
import { getDashboard } from "@/lib/services/dashboard";

export const GET = apiHandler(
  async (request) => {
    const { searchParams } = new URL(request.url);
    return getDashboard(
      searchParams.get("period") || "30d",
      searchParams.get("from"),
      searchParams.get("to"),
    );
  },
  { permission: PERMISSIONS.DASHBOARD_VIEW },
);
