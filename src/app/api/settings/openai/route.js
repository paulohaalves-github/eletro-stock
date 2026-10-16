import { apiHandler, readJson } from "@/lib/api";
import { PERMISSIONS } from "@/lib/permissions";
import { getOpenAISettings, publicOpenAISettings, saveOpenAISettings } from "@/lib/services/settings";

export const GET = apiHandler(
  async () => {
    const settings = publicOpenAISettings(await getOpenAISettings());
    return { settings };
  },
  { permission: PERMISSIONS.USER_MANAGE },
);

export const PUT = apiHandler(
  async (request, { session }) => {
    const body = await readJson(request);
    const settings = await saveOpenAISettings(body, session);
    return { settings, message: "Consulta por IA salva." };
  },
  { permission: PERMISSIONS.USER_MANAGE },
);
