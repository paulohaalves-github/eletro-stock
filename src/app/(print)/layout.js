import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import "./labels.css";

export const dynamic = "force-dynamic";

export default async function PrintLayout({ children }) {
  const session = await getSession();
  if (!session) redirect("/login");
  return <div className="label-print-root">{children}</div>;
}
