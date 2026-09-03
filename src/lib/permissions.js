import { ROLES } from "./constants";

export const PERMISSIONS = {
  PRODUCT_CREATE: "product:create",
  PRODUCT_EDIT: "product:edit",
  PRODUCT_VIEW: "product:view",
  STOCK_ENTRY: "stock:entry",
  STOCK_EXIT: "stock:exit",
  STOCK_RESERVE: "stock:reserve",
  CONDITION_CHANGE: "product:condition",
  PHOTO_UPLOAD: "photo:upload",
  PHOTO_DELETE: "photo:delete",
  USER_MANAGE: "user:manage",
  CATEGORY_MANAGE: "category:manage",
  LINE_MANAGE: "line:manage",
  LOCATION_MANAGE: "location:manage",
  LOCATION_ASSIGN: "location:assign",
  HISTORY_VIEW: "history:view",
  DASHBOARD_VIEW: "dashboard:view",
  REPORT_VIEW: "report:view",
  AUDIT_VIEW: "audit:view",
};

const ROLE_PERMISSIONS = {
  [ROLES.ADMIN]: Object.values(PERMISSIONS),
  [ROLES.GESTOR]: Object.values(PERMISSIONS).filter((permission) => permission !== PERMISSIONS.USER_MANAGE),
  [ROLES.STOCK]: [
    PERMISSIONS.PRODUCT_CREATE,
    PERMISSIONS.PRODUCT_VIEW,
    PERMISSIONS.STOCK_ENTRY,
    PERMISSIONS.STOCK_EXIT,
    PERMISSIONS.STOCK_RESERVE,
    PERMISSIONS.PHOTO_UPLOAD,
    PERMISSIONS.PHOTO_DELETE,
    PERMISSIONS.LOCATION_MANAGE,
    PERMISSIONS.LOCATION_ASSIGN,
    PERMISSIONS.HISTORY_VIEW,
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.REPORT_VIEW,
  ],
  [ROLES.VIEWER]: [
    PERMISSIONS.PRODUCT_VIEW,
    PERMISSIONS.HISTORY_VIEW,
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.REPORT_VIEW,
  ],
};

export function getPermissions(role) {
  return ROLE_PERMISSIONS[role] ?? [];
}

export function can(role, permission) {
  return getPermissions(role).includes(permission);
}

export function assertCan(role, permission) {
  if (!can(role, permission)) {
    const error = new Error("Você não tem permissão para esta operação.");
    error.status = 403;
    error.code = "FORBIDDEN";
    throw error;
  }
}
