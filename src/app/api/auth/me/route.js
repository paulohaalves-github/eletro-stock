import { apiHandler } from "@/lib/api";
import { getSession, publicUser } from "@/lib/auth";

export const GET = apiHandler(async () => {
  const session = await getSession();
  return { user: session ? publicUser(session) : null };
});
