import { apiHandler } from "@/lib/api";
import { PERMISSIONS } from "@/lib/permissions";
import { listPartRequests } from "@/lib/services/parts";

export const GET = apiHandler(
  async (request, { session }) => {
    const { searchParams } = new URL(request.url);
    return listPartRequests(
      {
        status: searchParams.get("status"),
        q: searchParams.get("q"),
        page: searchParams.get("page"),
        pageSize: searchParams.get("pageSize"),
      },
      session,
    );
  },
  { permission: PERMISSIONS.PART_VIEW },
);
