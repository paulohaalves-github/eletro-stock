export const ROLES = {
  ADMIN: "ADMINISTRADOR",
  GESTOR: "GESTOR",
  STOCK: "ESTOQUE",
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

export const SERVICE_PLACES = {
  LAB: "LABORATORIO",
  CUSTOMER_HOME: "CASA_CLIENTE",
};

export const SERVICE_PLACE_LABELS = {
  LABORATORIO: "Laboratório do grupo",
  CASA_CLIENTE: "Casa do cliente",
};

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
