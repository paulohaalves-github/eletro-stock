import { apiHandler, readJson } from "@/lib/api";
import { PERMISSIONS } from "@/lib/permissions";
import { createPart, listParts } from "@/lib/services/parts";

export const GET = apiHandler(
  async (request, { session }) => {
    const { searchParams } = new URL(request.url);
    return listParts(
      {
        q: searchParams.get("q"),
        active: searchParams.get("active"),
        page: searchParams.get("page"),
        pageSize: searchParams.get("pageSize"),
      },
      session,
    );
  },
  { permission: PERMISSIONS.PART_VIEW },
);

export const POST = apiHandler(
  async (request, { session }) => {
    const body = await readJson(request);
    const part = await createPart(body, session);
    return { part, message: "Peça cadastrada." };
  },
  { permission: PERMISSIONS.PART_MANAGE },
);
