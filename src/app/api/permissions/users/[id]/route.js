import { apiHandler, readJson } from "@/lib/api";
import { PERMISSIONS } from "@/lib/permissions";
import { getUserPermissionDetail, updateUserPermissionOverrides } from "@/lib/services/permissions";

export const GET = apiHandler(
  async (_request, { session: _session, params }) => {
    const { id } = await params;
    return getUserPermissionDetail(id);
  },
  { permission: PERMISSIONS.USER_MANAGE },
);

export const PUT = apiHandler(
  async (request, { session, params }) => {
    const { id } = await params;
    const body = await readJson(request);
    return updateUserPermissionOverrides(id, body.permissions, session);
  },
  { permission: PERMISSIONS.USER_MANAGE },
);
