import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { can, PERMISSIONS } from "@/lib/permissions";

export default async function LixeiraLayout({ children }) {
  const session = await getSession();
  if (!session || !can(session.role, PERMISSIONS.PRODUCT_TRASH)) {
    redirect("/");
  }
  return children;
}
