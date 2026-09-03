import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { can, PERMISSIONS } from "@/lib/permissions";

export default async function LocalizacoesLayout({ children }) {
  const session = await getSession();
  if (!session || !can(session.role, PERMISSIONS.LOCATION_MANAGE)) {
    redirect("/");
  }
  return children;
}
