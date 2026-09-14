import { apiHandler, readJson } from "@/lib/api";
import { PERMISSIONS } from "@/lib/permissions";
import { getPart, updatePart } from "@/lib/services/parts";
import { parseId } from "@/lib/validations";

export const GET = apiHandler(
  async (_request, { params, session }) => {
    const { id } = await params;
    const part = await getPart(parseId(id), session);
    return { part };
  },
  { permission: PERMISSIONS.PART_VIEW },
);

export const PATCH = apiHandler(
  async (request, { params, session }) => {
    const { id } = await params;
    const body = await readJson(request);
    const part = await updatePart(parseId(id), body, session);
    return { part, message: "Peça atualizada." };
  },
  { permission: PERMISSIONS.PART_MANAGE },
);
