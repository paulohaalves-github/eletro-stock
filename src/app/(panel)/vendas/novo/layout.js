import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { can, PERMISSIONS } from "@/lib/permissions";

export default async function NovaVendaLayout({ children }) {
  const session = await getSession();
  if (!session || !can(session.role, PERMISSIONS.SALE_CREATE)) {
    redirect("/vendas");
  }
  return children;
}
