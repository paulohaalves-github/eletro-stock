export const ROLES = {
  ADMIN: "ADMINISTRADOR",
  GESTOR: "GESTOR",
  STOCK: "ESTOQUE",
  SELLER: "VENDEDOR",
  TECHNICIAN: "TECNICO",
  VIEWER: "CONSULTA",
};

export const UNIT_TYPES = {
  HQ: "MATRIZ",
  BRANCH: "FILIAL",
  LAB: "LABORATORIO",
};

export const UNIT_TYPE_LABELS = {
  MATRIZ: "Matriz",
  FILIAL: "Filial",
  LABORATORIO: "Laboratório",
};

export const ROLE_LABELS = {
  ADMINISTRADOR: "Administrador",
  GESTOR: "Gestor",
  ESTOQUE: "Estoque",
  VENDEDOR: "Vendedor",
  TECNICO: "Técnico",
  CONSULTA: "Consulta",
};

export const CONDITIONS = {
  NEW: "NOVO",
  NEW_DAMAGE: "NOVO_COM_AVARIA",
  REVISED: "REVISADO",
};

export const CONDITION_LABELS = {
  NOVO: "Novo",
  NOVO_COM_AVARIA: "Novo com avaria",
  REVISADO: "Revisado",
};

export const VOLTAGES = {
  V110: "110V",
  V220: "220V",
  BIVOLT: "BIVOLT",
};

export const VOLTAGE_LABELS = {
  "110V": "110V",
  "220V": "220V",
  BIVOLT: "BIVOLT",
};

export const STATUSES = {
  AVAILABLE: "DISPONIVEL",
  RESERVED: "RESERVADO",
  IN_TRANSIT: "EM_TRANSITO",
  SOLD: "VENDIDO",
  IN_REPAIR: "EM_REPARO",
  TRANSFERRED: "TRANSFERIDO",
  RETURNED: "DEVOLVIDO",
  DISCARDED: "DESCARTADO",
};

export const STATUS_LABELS = {
  DISPONIVEL: "Disponível",
  RESERVADO: "Reservado",
  EM_TRANSITO: "Em trânsito",
  VENDIDO: "Vendido",
  EM_REPARO: "Em reparo",
  TRANSFERIDO: "Transferido",
  DEVOLVIDO: "Devolvido",
  DESCARTADO: "Descartado",
};

export const MOVEMENT_TYPES = {
  ENTRY: "ENTRADA",
  EXIT: "SAIDA",
  RESERVE: "RESERVA",
  UNRESERVE: "LIBERACAO_RESERVA",
  TRANSFER: "TRANSFERENCIA",
  TRANSFER_SEND: "TRANSFERENCIA_ENVIO",
  TRANSFER_RECEIVE: "TRANSFERENCIA_RECEBIMENTO",
  TRANSFER_CANCEL: "TRANSFERENCIA_CANCELADA",
  TRANSFER_REFUSE: "TRANSFERENCIA_RECUSADA",
  CONDITION_CHANGE: "ALTERACAO_CONDICAO",
  PRICE_CHANGE: "ALTERACAO_PRECO",
  UPDATE: "ALTERACAO",
  PHOTO_ADD: "FOTO_ADICIONADA",
  PHOTO_REMOVE: "FOTO_REMOVIDA",
  FILE_ADD: "ANEXO_ADICIONADO",
  FILE_REMOVE: "ANEXO_REMOVIDO",
  LOCATION_CHANGE: "ALTERACAO_LOCALIZACAO",
  REPAIR_OPEN: "REPARO_ABERTURA",
  REPAIR_TO_LAB: "REPARO_ENVIO_LAB",
  REPAIR_DELIVER: "REPARO_ENTREGA",
  TRASH: "LIXEIRA",
  RESTORE: "RESTAURACAO",
};

export const MOVEMENT_TYPE_LABELS = {
  ENTRADA: "Entrada no estoque",
  SAIDA: "Saída do estoque",
  RESERVA: "Produto reservado",
  LIBERACAO_RESERVA: "Reserva liberada",
  TRANSFERENCIA: "Produto transferido",
  TRANSFERENCIA_ENVIO: "Enviado para outra unidade",
  TRANSFERENCIA_RECEBIMENTO: "Recebido de outra unidade",
  TRANSFERENCIA_CANCELADA: "Transferência cancelada",
  TRANSFERENCIA_RECUSADA: "Transferência recusada",
  ALTERACAO_CONDICAO: "Condição alterada",
  ALTERACAO_PRECO: "Preço alterado",
  ALTERACAO: "Produto alterado",
  FOTO_ADICIONADA: "Fotos adicionadas",
  FOTO_REMOVIDA: "Foto removida",
  ANEXO_ADICIONADO: "Anexo adicionado",
  ANEXO_REMOVIDO: "Anexo removido",
  ALTERACAO_LOCALIZACAO: "Localização alterada",
  REPARO_ABERTURA: "Aberto para reparo técnico",
  REPARO_ENVIO_LAB: "Enviado ao laboratório",
  REPARO_ENTREGA: "Devolvido ao cliente após reparo",
  LIXEIRA: "Movido para a lixeira",
  RESTAURACAO: "Restaurado da lixeira",
};

export const EXIT_REASONS = {
  SALE: "VENDA",
  TRANSFER: "TRANSFERENCIA",
  RETURN: "DEVOLUCAO",
  DAMAGE: "AVARIA",
  DISCARD: "DESCARTE",
  OTHER: "OUTRO",
};

export const EXIT_REASON_LABELS = {
  VENDA: "Venda",
  TRANSFERENCIA: "Transferência externa",
  DEVOLUCAO: "Devolução",
  AVARIA: "Avaria",
  DESCARTE: "Descarte",
  OUTRO: "Outro",
};

export const STOCK_EXIT_REASON_LABELS = Object.fromEntries(
  Object.entries(EXIT_REASON_LABELS).filter(([value]) => value !== EXIT_REASONS.SALE),
);

export const EXIT_REASON_TO_STATUS = {
  VENDA: "VENDIDO",
  TRANSFERENCIA: "TRANSFERIDO",
  DEVOLUCAO: "DEVOLVIDO",
  AVARIA: "DESCARTADO",
  DESCARTE: "DESCARTADO",
  OUTRO: "DESCARTADO",
};

export const CLOSED_STATUSES = ["VENDIDO", "TRANSFERIDO", "DESCARTADO", "DEVOLVIDO"];

export function isInTransit(status) {
  return status === STATUSES.IN_TRANSIT;
}

export function isInRepair(status) {
  return status === STATUSES.IN_REPAIR;
}

export function canOperateStock(status) {
  return !CLOSED_STATUSES.includes(status) && !isInTransit(status) && !isInRepair(status);
}

export const WARRANTY_MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

export const SALE_ORDER_STATUSES = {
  INTEREST: "INTERESSE",
  RESERVED: "RESERVADA",
  ORDER: "PEDIDO",
  PARTIAL: "PARCIAL",
  COMPLETED: "CONCRETIZADA",
  LOST: "PERDIDA",
  CANCELLED: "CANCELADA",
};

export const SALE_ORDER_STATUS_LABELS = {
  INTERESSE: "Interesse",
  RESERVADA: "Reservada",
  PEDIDO: "Pedido gerado",
  PARCIAL: "Parcialmente concretizada",
  CONCRETIZADA: "Concretizada",
  PERDIDA: "Perdida",
  CANCELADA: "Cancelada",
};

export const SALE_ORDER_CLOSED_STATUSES = ["CONCRETIZADA", "PERDIDA", "CANCELADA"];

export const SALE_ORDER_ITEM_STATUSES = {
  INTEREST: "INTERESSE",
  RESERVED: "RESERVADO",
  ORDERED: "PEDIDO",
  SOLD: "VENDIDO",
  REMOVED: "REMOVIDO",
};

export const SALE_ORDER_ITEM_STATUS_LABELS = {
  INTERESSE: "Interesse",
  RESERVADO: "Reservado",
  PEDIDO: "No pedido",
  VENDIDO: "Vendido",
  REMOVIDO: "Removido",
};

export const SALE_ORDER_EVENT_TYPES = {
  OPEN: "ABERTURA",
  PRODUCT: "PRODUTO",
  RESERVE: "RESERVA",
  ORDER: "PEDIDO",
  CHECKOUT: "BAIXA",
  STATUS: "STATUS",
  NOTE: "NOTA",
  CLOSE: "ENCERRAMENTO",
};

export const SALE_ORDER_EVENT_LABELS = {
  ABERTURA: "Abertura",
  PRODUTO: "Produto",
  RESERVA: "Reserva",
  PEDIDO: "Pedido",
  BAIXA: "Baixa no caixa",
  STATUS: "Status",
  NOTA: "Comentário",
  ENCERRAMENTO: "Encerramento",
};

export function isSaleOrderClosed(order) {
  if (!order) return false;
  if (order.closedAt) return true;
  return SALE_ORDER_CLOSED_STATUSES.includes(order.status);
}

export const SERVICE_PLACES = {
  LAB: "LABORATORIO",
  CUSTOMER_HOME: "CASA_CLIENTE",
};

export const SERVICE_PLACE_LABELS = {
  LABORATORIO: "Laboratório do grupo",
  CASA_CLIENTE: "Casa do cliente",
};

export const WORK_ORDER_TYPES = {
  AFTER_SALES: "POS_VENDA",
  STOCK_REPAIR: "REPARO_ESTOQUE",
};

export const WORK_ORDER_TYPE_LABELS = {
  POS_VENDA: "Pós-venda",
  REPARO_ESTOQUE: "Reparo de estoque",
};

export const WORK_ORDER_OPENABLE_STATUSES = ["DISPONIVEL", "RESERVADO", "DEVOLVIDO", "VENDIDO"];

export function resolveWorkOrderType(product) {
  if (product?.status === STATUSES.SOLD) return WORK_ORDER_TYPES.AFTER_SALES;
  return WORK_ORDER_TYPES.STOCK_REPAIR;
}

export function isStockRepair(order) {
  return (order?.type || WORK_ORDER_TYPES.AFTER_SALES) === WORK_ORDER_TYPES.STOCK_REPAIR;
}

export const WORK_ORDER_STATUSES = {
  OPEN: "ABERTA",
  ANALYSIS: "EM_ANALISE",
  WAITING_PART: "AGUARDANDO_PECA",
  REPAIRING: "EM_REPARO",
  READY: "PRONTO",
  DELIVERED: "ENTREGUE",
  UNREPAIRABLE: "SEM_REPARO",
  CANCELLED: "CANCELADA",
};

export const WORK_ORDER_STATUS_LABELS = {
  ABERTA: "Aberta",
  EM_ANALISE: "Em análise",
  AGUARDANDO_PECA: "Aguardando peça",
  EM_REPARO: "Em reparo",
  PRONTO: "Pronto para entrega",
  ENTREGUE: "Entregue ao cliente",
  SEM_REPARO: "Sem reparo",
  CANCELADA: "Cancelada",
};

export const WORK_ORDER_CLOSED_STATUSES = ["ENTREGUE", "SEM_REPARO", "CANCELADA"];

export const WORK_ORDER_EVENT_TYPES = {
  OPEN: "ABERTURA",
  STATUS: "STATUS",
  ANALYSIS: "ANALISE",
  TECHNICIAN_NOTE: "APONTAMENTO",
  NOTE: "NOTA",
  DELIVERY: "ENTREGA",
  LOCATION: "LOCALIZACAO",
  PART_REQUESTED: "PECA_SOLICITADA",
  EVIDENCE: "EVIDENCIA",
};

export const WORK_ORDER_EVENT_LABELS = {
  ABERTURA: "Abertura",
  STATUS: "Status",
  ANALISE: "Análise",
  APONTAMENTO: "Apontamento do técnico",
  NOTA: "Atualização",
  ENTREGA: "Entrega",
  LOCALIZACAO: "Localização",
  PECA_SOLICITADA: "Peça",
  EVIDENCIA: "Evidência",
};

export const WORK_ORDER_INTERACTION_TYPES = {
  ANALYSIS: "ANALISE",
  TECHNICIAN_NOTE: "APONTAMENTO",
  NOTE: "NOTA",
  EVIDENCE: "EVIDENCIA",
};

export const WORK_ORDER_PART_STATUSES = {
  REQUESTED: "SOLICITADA",
  FULFILLED: "ATENDIDA",
  REFUSED: "RECUSADA",
};

export const WORK_ORDER_PART_STATUS_LABELS = {
  SOLICITADA: "Solicitada",
  ATENDIDA: "Atendida",
  RECUSADA: "Recusada",
};

export const PART_MOVEMENT_TYPES = {
  ENTRY: "ENTRADA",
  EXIT: "SAIDA",
  LOCATION_CHANGE: "ALTERACAO_LOCALIZACAO",
  TRANSFER_SEND: "TRANSFERENCIA_ENVIO",
  TRANSFER_RECEIVE: "TRANSFERENCIA_RECEBIMENTO",
  TRANSFER_CANCEL: "TRANSFERENCIA_CANCELADA",
  TRANSFER_REFUSE: "TRANSFERENCIA_RECUSADA",
  OS_OUT: "BAIXA_OS",
};

export const PART_MOVEMENT_TYPE_LABELS = {
  ENTRADA: "Entrada de peça",
  SAIDA: "Saída de peça",
  ALTERACAO_LOCALIZACAO: "Localização alterada",
  TRANSFERENCIA_ENVIO: "Enviada para outra unidade",
  TRANSFERENCIA_RECEBIMENTO: "Recebida de outra unidade",
  TRANSFERENCIA_CANCELADA: "Transferência cancelada",
  TRANSFERENCIA_RECUSADA: "Transferência recusada",
  BAIXA_OS: "Baixa para ordem de serviço",
};

export const PART_TRANSFER_STATUSES = {
  IN_TRANSIT: "EM_TRANSITO",
  RECEIVED: "RECEBIDO",
  CANCELLED: "CANCELADO",
  REFUSED: "RECUSADO",
};

export function addMonths(date, months) {
  const source = new Date(date);
  const day = source.getDate();
  const next = new Date(source);
  next.setMonth(next.getMonth() + Number(months));
  if (next.getDate() < day) next.setDate(0);
  return next;
}

export function warrantyExpiresAt(soldAt, months) {
  return addMonths(soldAt, months);
}

export function isWarrantyValid(soldAt, months, at = new Date()) {
  return warrantyExpiresAt(soldAt, months) >= at;
}

export const IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp"];
export const DOCUMENT_MIME_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];
export const DOCUMENT_EXTENSIONS = [".pdf", ".doc", ".docx"];
export const INBOX_VIDEO_MIME_TYPES = ["video/mp4", "video/3gpp", "video/quicktime"];
export const INBOX_VIDEO_EXTENSIONS = [".mp4", ".3gp", ".mov"];
export const INBOX_DOCUMENT_MIME_TYPES = [
  ...DOCUMENT_MIME_TYPES,
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
  "application/zip",
];
export const INBOX_DOCUMENT_EXTENSIONS = [...DOCUMENT_EXTENSIONS, ".xls", ".xlsx", ".txt", ".zip"];
export const INBOX_MAX_UPLOAD_BYTES = Number(process.env.INBOX_MAX_UPLOAD_MB || 16) * 1024 * 1024;

export const MAX_UPLOAD_BYTES = Number(process.env.MAX_UPLOAD_MB || 8) * 1024 * 1024;
export const MAX_IMAGES_PER_PRODUCT = 20;

export const PRICE_RANGES = [
  { id: "0-1000", label: "Até R$ 1.000", min: 0, max: 1000 },
  { id: "1000-3000", label: "R$ 1.000 a R$ 3.000", min: 1000, max: 3000 },
  { id: "3000-6000", label: "R$ 3.000 a R$ 6.000", min: 3000, max: 6000 },
  { id: "6000-10000", label: "R$ 6.000 a R$ 10.000", min: 6000, max: 10000 },
  { id: "10000+", label: "Acima de R$ 10.000", min: 10000, max: null },
];

export const PRICE_STALE_DAYS = [
  { value: "10", label: "Mais de 10 dias" },
  { value: "20", label: "Mais de 20 dias" },
  { value: "30", label: "Mais de 30 dias" },
  { value: "60", label: "Mais de 60 dias" },
  { value: "90", label: "Mais de 90 dias" },
];

export const LIST_PAGE_SIZE = 50;
export const ESTOQUE_PAGE_SIZE = LIST_PAGE_SIZE;


export const DASHBOARD_PERIODS = {
  today: { label: "Hoje", days: 0 },
  "7d": { label: "7 dias", days: 7 },
  "30d": { label: "30 dias", days: 30 },
  "90d": { label: "90 dias", days: 90 },
  custom: { label: "Personalizado", days: null },
};

export const SESSION_COOKIE = "eletro_stock_session";
export const UNIT_COOKIE = "eletro_stock_unit";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7;

export const LABEL_MODELS = {
  PRECOS_01: "1",
  PRECOS_02: "2",
};

export const LABEL_MODEL_OPTIONS = [
  {
    id: LABEL_MODELS.PRECOS_01,
    label: "Modelo de Preços 01",
    description: "Etiqueta 9 × 4,5 cm (90 × 45 mm)",
  },
  {
    id: LABEL_MODELS.PRECOS_02,
    label: "Modelo de Preços 02",
    description: "2 colunas · 5×2,5 cm (página 10,3×2,5)",
  },
];

export function resolveLabelModel(value) {
  const model = String(value || LABEL_MODELS.PRECOS_01);
  return model === LABEL_MODELS.PRECOS_02 ? LABEL_MODELS.PRECOS_02 : LABEL_MODELS.PRECOS_01;
}

export const INBOX_CHANNEL_TYPES = {
  WHATSAPP: "WHATSAPP",
};

export const INBOX_CHANNEL_TYPE_LABELS = {
  WHATSAPP: "WhatsApp",
};

export const INBOX_PROVIDERS = {
  DIALOG_360: "DIALOG_360",
  UNOFFICIAL: "UNOFFICIAL",
};

export const INBOX_PROVIDER_LABELS = {
  DIALOG_360: "WhatsApp oficial (360dialog)",
  UNOFFICIAL: "WhatsApp não oficial",
};

export const INBOX_CONNECTION_STATUSES = {
  DISCONNECTED: "DISCONNECTED",
  QR_PENDING: "QR_PENDING",
  CONNECTED: "CONNECTED",
  ERROR: "ERROR",
};

export const INBOX_CONNECTION_STATUS_LABELS = {
  DISCONNECTED: "Desconectado",
  QR_PENDING: "Aguardando QR Code",
  CONNECTED: "Conectado",
  ERROR: "Erro",
};

export const INBOX_TEAM_MEMBER_ROLES = {
  AGENT: "AGENT",
  SUPERVISOR: "SUPERVISOR",
};

export const INBOX_TEAM_MEMBER_ROLE_LABELS = {
  AGENT: "Agente",
  SUPERVISOR: "Supervisor",
};

export const CONVERSATION_STATUSES = {
  WAITING_AGENT: "AGUARDANDO_AGENTE",
  AGENT_REPLIED: "AGENTE_RESPONDEU",
  CLOSED: "ENCERRADA",
};

export const CONVERSATION_STATUS_LABELS = {
  AGUARDANDO_AGENTE: "Cliente aguardando resposta do agente",
  AGENTE_RESPONDEU: "Agente respondeu",
  ENCERRADA: "Conversa encerrada",
};

export const MESSAGE_DIRECTIONS = {
  IN: "IN",
  OUT: "OUT",
  INTERNAL: "INTERNAL",
};

export const MESSAGE_STATUSES = {
  PENDING: "PENDING",
  SENT: "SENT",
  DELIVERED: "DELIVERED",
  READ: "READ",
  FAILED: "FAILED",
};

export const CONVERSATION_EVENT_TYPES = {
  CREATED: "CRIADA",
  ACCEPTED: "ACEITA",
  TRANSFERRED: "TRANSFERIDA",
  CLOSED: "ENCERRADA",
  REOPENED: "REABERTA",
  NOTE: "NOTA",
  CUSTOMER: "CLIENTE",
  AUTOMATION: "AUTOMACAO",
};

export const CONVERSATION_EVENT_LABELS = {
  CRIADA: "Conversa iniciada",
  ACEITA: "Agente entrou na conversa",
  TRANSFERIDA: "Conversa transferida",
  ENCERRADA: "Conversa encerrada",
  REABERTA: "Conversa reaberta",
  NOTA: "Nota interna",
  CLIENTE: "Cliente vinculado",
  AUTOMACAO: "Resposta automática",
};

export const GREETING_MODES = {
  FIRST_CONTACT: "FIRST_CONTACT",
  EVERY_NEW_CONVERSATION: "EVERY_NEW_CONVERSATION",
};

export const GREETING_MODE_LABELS = {
  FIRST_CONTACT: "Apenas uma vez no contato inicial",
  EVERY_NEW_CONVERSATION: "Sempre que o cliente começar uma nova conversa",
};

export const INBOX_TIMEZONES = [
  { value: "America/Sao_Paulo", label: "Brasília (UTC−3)" },
  { value: "America/Fortaleza", label: "Fortaleza (UTC−3)" },
  { value: "America/Recife", label: "Recife (UTC−3)" },
  { value: "America/Belem", label: "Belém (UTC−3)" },
  { value: "America/Manaus", label: "Manaus (UTC−4)" },
  { value: "America/Cuiaba", label: "Cuiabá (UTC−4)" },
  { value: "America/Porto_Velho", label: "Porto Velho (UTC−4)" },
  { value: "America/Rio_Branco", label: "Rio Branco (UTC−5)" },
  { value: "America/Noronha", label: "Fernando de Noronha (UTC−2)" },
];

export const WEEKDAY_LABELS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

export const UNANSWERED_MINUTE_OPTIONS = [2, 5, 10, 15, 30, 60];

export function defaultBusinessHours() {
  return WEEKDAY_LABELS.map((_, weekday) => ({
    weekday,
    enabled: weekday >= 1 && weekday <= 6,
    start: "08:00",
    end: weekday === 6 ? "12:00" : "18:00",
  }));
}
