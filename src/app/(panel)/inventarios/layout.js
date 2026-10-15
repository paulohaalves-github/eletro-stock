import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { can, PERMISSIONS } from "@/lib/permissions";

export default async function InventariosLayout({ children }) {
  const session = await getSession();
  const allowed = session && (
    can(session.role, PERMISSIONS.INVENTORY_MANAGE) || can(session.role, PERMISSIONS.INVENTORY_EXECUTE)
  );
  if (!allowed) redirect("/");
  return children;
}
