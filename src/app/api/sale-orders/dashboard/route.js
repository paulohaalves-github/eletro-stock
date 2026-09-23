import { apiHandler } from "@/lib/api";
import { PERMISSIONS } from "@/lib/permissions";
import { getSaleDashboard } from "@/lib/services/sale-dashboard";

export const GET = apiHandler(
  async (request, { session }) => {
    const { searchParams } = new URL(request.url);
    return getSaleDashboard(session, {
      period: searchParams.get("period") || "30d",
      from: searchParams.get("from"),
      to: searchParams.get("to"),
    });
  },
  { permission: PERMISSIONS.SALE_VIEW },
);
