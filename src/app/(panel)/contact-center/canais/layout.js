import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { can, PERMISSIONS } from "@/lib/permissions";

export default async function CanaisLayout({ children }) {
  const session = await getSession();
  if (!session || !can(session.role, PERMISSIONS.INBOX_CHANNEL_MANAGE)) {
    redirect("/contact-center");
  }
  return children;
}
