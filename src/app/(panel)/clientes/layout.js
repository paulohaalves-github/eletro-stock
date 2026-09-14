import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { can, PERMISSIONS } from "@/lib/permissions";

export default async function ClientesLayout({ children }) {
  const session = await getSession();
  if (!session || !can(session.role, PERMISSIONS.CUSTOMER_VIEW)) {
    redirect("/");
  }
  return children;
}
