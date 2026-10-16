import { apiHandler, readJson } from "@/lib/api";
import { PERMISSIONS } from "@/lib/permissions";
import { getCareSettings, listCareSyncUnits, publicCareSettings, saveCareSettings } from "@/lib/services/settings";

export const GET = apiHandler(
  async () => {
    const [settings, units] = await Promise.all([
      getCareSettings(),
      listCareSyncUnits(),
    ]);
    return { settings: publicCareSettings(settings), units };
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
