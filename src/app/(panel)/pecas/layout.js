import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { can, PERMISSIONS } from "@/lib/permissions";

export default async function PecasLayout({ children }) {
  const session = await getSession();
  if (!session || !can(session.role, PERMISSIONS.PART_VIEW)) {
    redirect("/");
  }
  return children;
}
