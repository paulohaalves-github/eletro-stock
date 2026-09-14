import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { can, PERMISSIONS } from "@/lib/permissions";

export default async function NovaOsLayout({ children }) {
  const session = await getSession();
  if (!session || !can(session.role, PERMISSIONS.REPAIR_CREATE)) {
    redirect("/reparos");
  }
  return children;
}
