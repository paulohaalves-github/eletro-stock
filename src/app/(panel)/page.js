import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { can, canAccessGestao, PERMISSIONS } from "@/lib/permissions";

export default async function HomePage() {
  const session = await getSession();
  if (canAccessGestao(session)) redirect("/dashboards");
  if (can(session, PERMISSIONS.PRODUCT_VIEW)) redirect("/estoque");
  if (can(session, PERMISSIONS.SALE_VIEW)) redirect("/vendas");
  if (can(session, PERMISSIONS.REPAIR_VIEW)) redirect("/reparos");
  if (can(session, PERMISSIONS.INBOX_VIEW)) redirect("/contact-center");
  redirect("/vendas");
}
