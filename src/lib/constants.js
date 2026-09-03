export const ROLES = {
  ADMIN: "ADMINISTRADOR",
  GESTOR: "GESTOR",
  STOCK: "ESTOQUE",
  VIEWER: "CONSULTA",
};

export const ROLE_LABELS = {
  ADMINISTRADOR: "Administrador",
  GESTOR: "Gestor",
  ESTOQUE: "Estoque",
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
  SOLD: "VENDIDO",
  TRANSFERRED: "TRANSFERIDO",
  RETURNED: "DEVOLVIDO",
  DISCARDED: "DESCARTADO",
};

export const STATUS_LABELS = {
  DISPONIVEL: "Disponível",
  RESERVADO: "Reservado",
  VENDIDO: "Vendido",
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
  CONDITION_CHANGE: "ALTERACAO_CONDICAO",
  PRICE_CHANGE: "ALTERACAO_PRECO",
  UPDATE: "ALTERACAO",
  PHOTO_ADD: "FOTO_ADICIONADA",
  PHOTO_REMOVE: "FOTO_REMOVIDA",
  FILE_ADD: "ANEXO_ADICIONADO",
  FILE_REMOVE: "ANEXO_REMOVIDO",
  LOCATION_CHANGE: "ALTERACAO_LOCALIZACAO",
};

export const MOVEMENT_TYPE_LABELS = {
  ENTRADA: "Entrada no estoque",
  SAIDA: "Saída do estoque",
  RESERVA: "Produto reservado",
  LIBERACAO_RESERVA: "Reserva liberada",
  TRANSFERENCIA: "Produto transferido",
  ALTERACAO_CONDICAO: "Condição alterada",
  ALTERACAO_PRECO: "Preço alterado",
  ALTERACAO: "Produto alterado",
  FOTO_ADICIONADA: "Fotos adicionadas",
  FOTO_REMOVIDA: "Foto removida",
  ANEXO_ADICIONADO: "Anexo adicionado",
  ANEXO_REMOVIDO: "Anexo removido",
  ALTERACAO_LOCALIZACAO: "Localização alterada",
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
  TRANSFERENCIA: "Transferência",
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

export const DASHBOARD_PERIODS = {
  today: { label: "Hoje", days: 0 },
  "7d": { label: "7 dias", days: 7 },
  "30d": { label: "30 dias", days: 30 },
  "90d": { label: "90 dias", days: 90 },
  custom: { label: "Personalizado", days: null },
};

export const SESSION_COOKIE = "eletro_stock_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7;
