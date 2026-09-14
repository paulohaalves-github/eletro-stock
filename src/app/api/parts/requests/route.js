import { apiHandler } from "@/lib/api";
import { PERMISSIONS } from "@/lib/permissions";
import { listPartRequests } from "@/lib/services/parts";

export const GET = apiHandler(
  async (request, { session }) => {
    const { searchParams } = new URL(request.url);
    const items = await listPartRequests({ status: searchParams.get("status") }, session);
    return { items };
  },
  { permission: PERMISSIONS.PART_VIEW },
);
