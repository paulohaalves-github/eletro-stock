import { apiHandler, readJson } from "@/lib/api";
import { PERMISSIONS } from "@/lib/permissions";
import { upsertLine } from "@/lib/services/catalog";
import { parseId } from "@/lib/validations";

export const PATCH = apiHandler(
  async (request, { params, session }) => {
    const { id } = await params;
    const body = await readJson(request);
    const line = await upsertLine(body, session, parseId(id));
    return { line, message: "Linha atualizada." };
  },
  { permission: PERMISSIONS.LINE_MANAGE },
);
