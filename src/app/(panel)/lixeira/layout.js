import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { can, canAccessGestao, PERMISSIONS } from "@/lib/permissions";

export default async function LixeiraLayout({ children }) {
  const session = await getSession();
  if (!session || !canAccessGestao(session) || !can(session, PERMISSIONS.PRODUCT_TRASH)) {
    redirect("/");
  }
  return children;
}
