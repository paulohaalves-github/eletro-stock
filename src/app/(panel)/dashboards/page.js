import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { DashboardsHub } from "@/components/dashboards/hub";
import { availableDashboardViews, resolveDashboardView } from "@/lib/dashboards";
import { canAccessGestao } from "@/lib/permissions";

export default async function DashboardsPage({ searchParams }) {
  const session = await getSession();
  if (!canAccessGestao(session?.role)) redirect("/estoque");
  const views = availableDashboardViews(session);
  if (!views.length) redirect("/estoque");
  const params = await searchParams;
  const requested = Array.isArray(params.view) ? params.view[0] : params.view;
  const view = resolveDashboardView(requested, views);
  return <DashboardsHub view={view} views={views} />;
}
