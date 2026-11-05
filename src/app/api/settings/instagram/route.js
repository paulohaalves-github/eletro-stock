import { apiHandler, readJson } from "@/lib/api";
import { PERMISSIONS } from "@/lib/permissions";
import { getInstagramSettings, publicInstagramSettings, saveInstagramSettings } from "@/lib/services/settings";

export const GET = apiHandler(
  async () => {
    const settings = publicInstagramSettings(await getInstagramSettings());
    return { settings };
  },
  { permission: PERMISSIONS.USER_MANAGE },
);

export const PUT = apiHandler(
  async (request, { session }) => {
    const body = await readJson(request);
    const settings = await saveInstagramSettings(body, session);
    return { settings, message: "Instagram salvo." };
  },
  { permission: PERMISSIONS.USER_MANAGE },
);
