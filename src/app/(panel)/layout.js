import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";

export const dynamic = "force-dynamic";

export default async function PanelLayout({ children }) {
  const session = await getSession();
  if (!session) redirect("/login");
  return <AppShell user={session}>{children}</AppShell>;
}
