import { apiHandler, readJson } from "@/lib/api";
import { PERMISSIONS } from "@/lib/permissions";
import { getPermissionCatalog, updateRolePermissions } from "@/lib/services/permissions";

export const GET = apiHandler(
  async () => getPermissionCatalog(),
  { permission: PERMISSIONS.USER_MANAGE },
);

export const PUT = apiHandler(
  async (request, { session }) => {
    const body = await readJson(request);
    return updateRolePermissions(body.role, body.permissions, session);
  },
  { permission: PERMISSIONS.USER_MANAGE },
);
