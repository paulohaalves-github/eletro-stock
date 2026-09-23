import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { can, PERMISSIONS } from "@/lib/permissions";

export default async function EquipesLayout({ children }) {
  const session = await getSession();
  if (!session || !can(session.role, PERMISSIONS.INBOX_TEAM_MANAGE)) {
    redirect("/contact-center");
  }
  return children;
}
