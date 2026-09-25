import { apiHandler, readJson } from "@/lib/api";
import { PERMISSIONS } from "@/lib/permissions";
import { getCareSettings, publicCareSettings, saveCareSettings } from "@/lib/services/settings";

export const GET = apiHandler(
  async () => {
    const settings = await getCareSettings();
    return { settings: publicCareSettings(settings) };
  },
  { permission: PERMISSIONS.USER_MANAGE },
);

export const PUT = apiHandler(
  async (request, { session }) => {
    const body = await readJson(request);
    const settings = await saveCareSettings(body, session);
    return { settings, message: "Configurações do Care salvas." };
  },
  { permission: PERMISSIONS.USER_MANAGE },
);
