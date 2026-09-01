import { apiHandler, readJson } from "@/lib/api";
import { PERMISSIONS } from "@/lib/permissions";
import { listLines, upsertLine } from "@/lib/services/catalog";

export const GET = apiHandler(async () => {
  const items = await listLines();
  return { items };
}, { permission: PERMISSIONS.PRODUCT_VIEW });

export const POST = apiHandler(
  async (request, { session }) => {
    const body = await readJson(request);
    const line = await upsertLine(body, session);
    return { line, message: "Linha cadastrada." };
  },
  { permission: PERMISSIONS.LINE_MANAGE },
);
