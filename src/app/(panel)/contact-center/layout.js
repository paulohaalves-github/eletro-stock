import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { can, PERMISSIONS } from "@/lib/permissions";

export default async function ContactCenterLayout({ children }) {
  const session = await getSession();
  if (!session || !can(session, PERMISSIONS.INBOX_VIEW)) {
    redirect("/");
  }
  return children;
}
