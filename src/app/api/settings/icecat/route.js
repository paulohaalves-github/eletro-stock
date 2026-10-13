import { apiHandler, readJson } from "@/lib/api";
import { PERMISSIONS } from "@/lib/permissions";
import { getIcecatSettings, publicIcecatSettings, saveIcecatSettings } from "@/lib/services/settings";

export const GET = apiHandler(
  async () => {
    const settings = publicIcecatSettings(await getIcecatSettings());
    return { settings };
  },
  { permission: PERMISSIONS.USER_MANAGE },
);

export const PUT = apiHandler(
  async (request, { session }) => {
    const body = await readJson(request);
    const settings = await saveIcecatSettings(body, session);
    return { settings, message: "Conexão do Icecat salva." };
  },
  { permission: PERMISSIONS.USER_MANAGE },
);
