import { can, PERMISSIONS } from "./permissions";

export const DASHBOARD_VIEWS = [
  { id: "produtos", label: "Produtos", permission: PERMISSIONS.DASHBOARD_VIEW },
  { id: "comercial", label: "Comercial", permission: PERMISSIONS.SALE_VIEW },
  { id: "contact-center", label: "Contact Center", permission: PERMISSIONS.INBOX_VIEW, supervisor: true },
];

export function canAccessDashboardView(user, view) {
  if (!user || !view) return false;
  if (!can(user.role, view.permission)) return false;
  if (view.supervisor && !user.inboxSupervisor) return false;
  return true;
}

export function availableDashboardViews(user) {
  return DASHBOARD_VIEWS.filter((view) => canAccessDashboardView(user, view));
}

export function resolveDashboardView(requested, views) {
  const match = views.find((view) => view.id === requested);
  return match?.id || views[0]?.id || null;
}

export function canAccessAnyDashboard(user) {
  return availableDashboardViews(user).length > 0;
}
