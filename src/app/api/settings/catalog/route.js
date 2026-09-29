import { apiHandler, readJson } from "@/lib/api";
import { PERMISSIONS } from "@/lib/permissions";
import { getCatalogSettings, saveCatalogSettings } from "@/lib/services/settings";

export const GET = apiHandler(
  async () => {
    const settings = await getCatalogSettings();
    return { settings };
  },
  { permission: PERMISSIONS.USER_MANAGE },
);

export const PUT = apiHandler(
  async (request, { session }) => {
    const body = await readJson(request);
    const settings = await saveCatalogSettings(body, session);
    return { settings, message: "Configurações do catálogo salvas." };
  },
  { permission: PERMISSIONS.USER_MANAGE },
);
