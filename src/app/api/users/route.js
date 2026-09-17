import { apiHandler, readJson } from "@/lib/api";
import { PERMISSIONS } from "@/lib/permissions";
import { createUser, listUsers } from "@/lib/services/catalog";

export const GET = apiHandler(async (request) => {
  const { searchParams } = new URL(request.url);
  return listUsers({
    q: searchParams.get("q"),
    page: searchParams.get("page"),
    pageSize: searchParams.get("pageSize"),
  });
}, { permission: PERMISSIONS.USER_MANAGE });

export const POST = apiHandler(
  async (request, { session }) => {
    const body = await readJson(request);
    const user = await createUser(body, session);
    return { user, message: "Usuário cadastrado." };
  },
  { permission: PERMISSIONS.USER_MANAGE },
);
