import { PERMISSION_EFFECTS, ROLES } from "./constants";

export const PERMISSIONS = {
  PRODUCT_CREATE: "product:create",
  PRODUCT_EDIT: "product:edit",
  PRICE_IMPORT: "product:price_import",
  PRODUCT_VIEW: "product:view",
  PRODUCT_TRASH: "product:trash",
  STOCK_ENTRY: "stock:entry",
  STOCK_EXIT: "stock:exit",
  STOCK_TRANSFER: "stock:transfer",
  STOCK_RESERVE: "stock:reserve",
  INVENTORY_MANAGE: "inventory:manage",
  INVENTORY_EXECUTE: "inventory:execute",
  CONDITION_CHANGE: "product:condition",
  PHOTO_UPLOAD: "photo:upload",
  PHOTO_DELETE: "photo:delete",
  USER_MANAGE: "user:manage",
  UNIT_MANAGE: "unit:manage",
  CATEGORY_MANAGE: "category:manage",
  LINE_MANAGE: "line:manage",
  LOCATION_MANAGE: "location:manage",
  LOCATION_ASSIGN: "location:assign",
  HISTORY_VIEW: "history:view",
  DASHBOARD_VIEW: "dashboard:view",
  REPORT_VIEW: "report:view",
  AUDIT_VIEW: "audit:view",
  CUSTOMER_VIEW: "customer:view",
  CUSTOMER_MANAGE: "customer:manage",
  SALE_VIEW: "sale:view",
  SALE_CREATE: "sale:create",
  SALE_CHECKOUT: "sale:checkout",
  SALE_DELETE: "sale:delete",
  REPAIR_VIEW: "repair:view",
  REPAIR_CREATE: "repair:create",
  REPAIR_UPDATE: "repair:update",
  REPAIR_DELETE: "repair:delete",
  PART_VIEW: "part:view",
  PART_MANAGE: "part:manage",
  PART_STOCK: "part:stock",
  INBOX_VIEW: "inbox:view",
  INBOX_REPLY: "inbox:reply",
  INBOX_ASSIGN: "inbox:assign",
  INBOX_TEAM_MANAGE: "inbox:team_manage",
  INBOX_CHANNEL_MANAGE: "inbox:channel_manage",
};

export const PERMISSION_LABELS = {
  [PERMISSIONS.PRODUCT_CREATE]: "Criar produtos",
  [PERMISSIONS.PRODUCT_EDIT]: "Editar produtos",
  [PERMISSIONS.PRICE_IMPORT]: "Importar preços",
  [PERMISSIONS.PRODUCT_VIEW]: "Ver produtos",
  [PERMISSIONS.PRODUCT_TRASH]: "Lixeira de produtos",
  [PERMISSIONS.STOCK_ENTRY]: "Entrada de estoque",
  [PERMISSIONS.STOCK_EXIT]: "Saída de estoque",
  [PERMISSIONS.STOCK_TRANSFER]: "Transferência de estoque",
  [PERMISSIONS.STOCK_RESERVE]: "Reservar estoque",
  [PERMISSIONS.INVENTORY_MANAGE]: "Gerenciar inventários",
  [PERMISSIONS.INVENTORY_EXECUTE]: "Executar inventários",
  [PERMISSIONS.CONDITION_CHANGE]: "Alterar condição do produto",
  [PERMISSIONS.PHOTO_UPLOAD]: "Enviar fotos",
  [PERMISSIONS.PHOTO_DELETE]: "Excluir fotos",
  [PERMISSIONS.USER_MANAGE]: "Gerenciar usuários",
  [PERMISSIONS.UNIT_MANAGE]: "Gerenciar unidades",
  [PERMISSIONS.CATEGORY_MANAGE]: "Gerenciar categorias",
  [PERMISSIONS.LINE_MANAGE]: "Gerenciar linhas",
  [PERMISSIONS.LOCATION_MANAGE]: "Gerenciar localizações",
  [PERMISSIONS.LOCATION_ASSIGN]: "Atribuir localização",
  [PERMISSIONS.HISTORY_VIEW]: "Ver movimentações",
  [PERMISSIONS.DASHBOARD_VIEW]: "Dashboards de produtos",
  [PERMISSIONS.REPORT_VIEW]: "Relatórios",
  [PERMISSIONS.AUDIT_VIEW]: "Auditoria",
  [PERMISSIONS.CUSTOMER_VIEW]: "Ver clientes",
  [PERMISSIONS.CUSTOMER_MANAGE]: "Gerenciar clientes",
  [PERMISSIONS.SALE_VIEW]: "Ver vendas",
  [PERMISSIONS.SALE_CREATE]: "Abrir / operar venda",
  [PERMISSIONS.SALE_CHECKOUT]: "Baixa no caixa",
  [PERMISSIONS.SALE_DELETE]: "Cancelar e retroagir vendas",
  [PERMISSIONS.REPAIR_VIEW]: "Ver reparos",
  [PERMISSIONS.REPAIR_CREATE]: "Criar reparos",
  [PERMISSIONS.REPAIR_UPDATE]: "Atualizar reparos",
  [PERMISSIONS.REPAIR_DELETE]: "Excluir reparos",
  [PERMISSIONS.PART_VIEW]: "Ver peças",
  [PERMISSIONS.PART_MANAGE]: "Gerenciar peças",
  [PERMISSIONS.PART_STOCK]: "Estoque de peças",
  [PERMISSIONS.INBOX_VIEW]: "Ver Contact Center",
  [PERMISSIONS.INBOX_REPLY]: "Responder conversas",
  [PERMISSIONS.INBOX_ASSIGN]: "Atribuir conversas",
  [PERMISSIONS.INBOX_TEAM_MANAGE]: "Gerenciar equipes",
  [PERMISSIONS.INBOX_CHANNEL_MANAGE]: "Gerenciar canais",
};

export const PERMISSION_GROUPS = [
  {
    id: "estoque",
    label: "Estoque",
    permissions: [
      PERMISSIONS.PRODUCT_VIEW,
      PERMISSIONS.PRODUCT_CREATE,
      PERMISSIONS.PRODUCT_EDIT,
      PERMISSIONS.PRICE_IMPORT,
      PERMISSIONS.PRODUCT_TRASH,
      PERMISSIONS.STOCK_ENTRY,
      PERMISSIONS.STOCK_EXIT,
      PERMISSIONS.STOCK_TRANSFER,
      PERMISSIONS.STOCK_RESERVE,
      PERMISSIONS.INVENTORY_MANAGE,
      PERMISSIONS.INVENTORY_EXECUTE,
      PERMISSIONS.CONDITION_CHANGE,
      PERMISSIONS.PHOTO_UPLOAD,
      PERMISSIONS.PHOTO_DELETE,
      PERMISSIONS.CATEGORY_MANAGE,
      PERMISSIONS.LINE_MANAGE,
      PERMISSIONS.LOCATION_MANAGE,
      PERMISSIONS.LOCATION_ASSIGN,
      PERMISSIONS.HISTORY_VIEW,
    ],
  },
  {
    id: "comercial",
    label: "Comercial",
    permissions: [
      PERMISSIONS.CUSTOMER_VIEW,
      PERMISSIONS.CUSTOMER_MANAGE,
      PERMISSIONS.SALE_VIEW,
      PERMISSIONS.SALE_CREATE,
      PERMISSIONS.SALE_CHECKOUT,
      PERMISSIONS.SALE_DELETE,
    ],
  },
  {
    id: "reparo",
    label: "Reparo e peças",
    permissions: [
      PERMISSIONS.REPAIR_VIEW,
      PERMISSIONS.REPAIR_CREATE,
      PERMISSIONS.REPAIR_UPDATE,
      PERMISSIONS.REPAIR_DELETE,
      PERMISSIONS.PART_VIEW,
      PERMISSIONS.PART_MANAGE,
      PERMISSIONS.PART_STOCK,
    ],
  },
  {
    id: "contact-center",
    label: "Contact Center",
    permissions: [
      PERMISSIONS.INBOX_VIEW,
      PERMISSIONS.INBOX_REPLY,
      PERMISSIONS.INBOX_ASSIGN,
      PERMISSIONS.INBOX_TEAM_MANAGE,
      PERMISSIONS.INBOX_CHANNEL_MANAGE,
    ],
  },
  {
    id: "gestao",
    label: "Gestão e administração",
    permissions: [
      PERMISSIONS.DASHBOARD_VIEW,
      PERMISSIONS.REPORT_VIEW,
      PERMISSIONS.AUDIT_VIEW,
      PERMISSIONS.USER_MANAGE,
      PERMISSIONS.UNIT_MANAGE,
    ],
  },
];

export const DEFAULT_ROLE_PERMISSIONS = {
  [ROLES.ADMIN]: Object.values(PERMISSIONS),
  [ROLES.GESTOR]: Object.values(PERMISSIONS).filter(
    (permission) => permission !== PERMISSIONS.USER_MANAGE && permission !== PERMISSIONS.UNIT_MANAGE,
  ),
  [ROLES.STOCK]: [
    PERMISSIONS.PRODUCT_CREATE,
    PERMISSIONS.PRODUCT_VIEW,
    PERMISSIONS.STOCK_ENTRY,
    PERMISSIONS.STOCK_EXIT,
    PERMISSIONS.STOCK_TRANSFER,
    PERMISSIONS.STOCK_RESERVE,
    PERMISSIONS.INVENTORY_EXECUTE,
    PERMISSIONS.PHOTO_UPLOAD,
    PERMISSIONS.PHOTO_DELETE,
    PERMISSIONS.LOCATION_MANAGE,
    PERMISSIONS.LOCATION_ASSIGN,
    PERMISSIONS.HISTORY_VIEW,
    PERMISSIONS.CUSTOMER_VIEW,
    PERMISSIONS.CUSTOMER_MANAGE,
    PERMISSIONS.SALE_VIEW,
    PERMISSIONS.SALE_CHECKOUT,
    PERMISSIONS.REPAIR_VIEW,
    PERMISSIONS.REPAIR_CREATE,
    PERMISSIONS.REPAIR_UPDATE,
    PERMISSIONS.PART_VIEW,
    PERMISSIONS.PART_MANAGE,
    PERMISSIONS.PART_STOCK,
    PERMISSIONS.INBOX_VIEW,
    PERMISSIONS.INBOX_REPLY,
    PERMISSIONS.INBOX_ASSIGN,
  ],
  [ROLES.CASHIER]: [
    PERMISSIONS.SALE_VIEW,
    PERMISSIONS.SALE_CHECKOUT,
  ],
  [ROLES.SELLER]: [
    PERMISSIONS.PRODUCT_VIEW,
    PERMISSIONS.HISTORY_VIEW,
    PERMISSIONS.CUSTOMER_VIEW,
    PERMISSIONS.CUSTOMER_MANAGE,
    PERMISSIONS.SALE_VIEW,
    PERMISSIONS.SALE_CREATE,
    PERMISSIONS.INBOX_VIEW,
    PERMISSIONS.INBOX_REPLY,
    PERMISSIONS.INBOX_ASSIGN,
  ],
  [ROLES.TECHNICIAN]: [
    PERMISSIONS.PRODUCT_VIEW,
    PERMISSIONS.PHOTO_UPLOAD,
    PERMISSIONS.HISTORY_VIEW,
    PERMISSIONS.CUSTOMER_VIEW,
    PERMISSIONS.CUSTOMER_MANAGE,
    PERMISSIONS.SALE_VIEW,
    PERMISSIONS.SALE_CREATE,
    PERMISSIONS.REPAIR_VIEW,
    PERMISSIONS.REPAIR_CREATE,
    PERMISSIONS.REPAIR_UPDATE,
    PERMISSIONS.PART_VIEW,
    PERMISSIONS.INBOX_VIEW,
    PERMISSIONS.INBOX_REPLY,
    PERMISSIONS.INBOX_ASSIGN,
  ],
  [ROLES.VIEWER]: [
    PERMISSIONS.PRODUCT_VIEW,
    PERMISSIONS.HISTORY_VIEW,
    PERMISSIONS.CUSTOMER_VIEW,
    PERMISSIONS.SALE_VIEW,
    PERMISSIONS.REPAIR_VIEW,
    PERMISSIONS.PART_VIEW,
  ],
};

function subjectRole(subject) {
  if (!subject) return null;
  if (typeof subject === "string") return subject;
  return subject.role || null;
}

export function getDefaultPermissions(role) {
  if (role === ROLES.ADMIN) return Object.values(PERMISSIONS);
  return DEFAULT_ROLE_PERMISSIONS[role] ?? [];
}

export function computeEffectivePermissions(role, rolePermissions, overrides = []) {
  if (role === ROLES.ADMIN) return Object.values(PERMISSIONS);
  const base = Array.isArray(rolePermissions) ? rolePermissions : getDefaultPermissions(role);
  const set = new Set(base);
  for (const item of overrides || []) {
    const permission = typeof item === "string" ? item : item?.permission;
    const effect = typeof item === "string" ? PERMISSION_EFFECTS.GRANT : item?.effect;
    if (!permission) continue;
    if (effect === PERMISSION_EFFECTS.DENY) set.delete(permission);
    else set.add(permission);
  }
  return [...set];
}

/** Aceita role (string) ou usuário/sessão com `permissions` ou `role`. */
export function getPermissions(subject) {
  if (!subject) return [];
  if (typeof subject === "string") return getDefaultPermissions(subject);
  if (Array.isArray(subject.permissions)) return subject.permissions;
  return getDefaultPermissions(subject.role);
}

export function can(subject, permission) {
  if (!subject || !permission) return false;
  return getPermissions(subject).includes(permission);
}

export function assertCan(subject, permission) {
  if (!can(subject, permission)) {
    const error = new Error("Você não tem permissão para esta operação.");
    error.status = 403;
    error.code = "FORBIDDEN";
    throw error;
  }
}

export function canAccessGestao(subject) {
  const role = subjectRole(subject);
  return role === ROLES.ADMIN || role === ROLES.GESTOR;
}

export function canManageAllSaleOrders(subject) {
  return canAccessGestao(subject);
}

export function canViewAllSaleOrders(subject) {
  return canManageAllSaleOrders(subject) || can(subject, PERMISSIONS.SALE_CHECKOUT);
}

export function canAccessSaleOrderRecord(user, saleOrder) {
  if (!user || !saleOrder) return false;
  if (canViewAllSaleOrders(user)) return true;
  return Number(saleOrder.sellerId) === Number(user.id);
}

export function isKnownPermission(permission) {
  return Object.values(PERMISSIONS).includes(permission);
}
