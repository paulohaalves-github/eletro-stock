import { apiHandler } from "@/lib/api";
import { PERMISSIONS } from "@/lib/permissions";
import { listMovements } from "@/lib/services/stock";

export const GET = apiHandler(
  async (request) => {
    const { searchParams } = new URL(request.url);
    return listMovements(Object.fromEntries(searchParams.entries()));
  },
  { permission: PERMISSIONS.HISTORY_VIEW },
);
