import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { canAccessGestao } from "@/lib/permissions";

export default async function RelatoriosLayout({ children }) {
  const session = await getSession();
  if (!canAccessGestao(session?.role)) redirect("/");
  return children;
}
