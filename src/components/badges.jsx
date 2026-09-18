import {
  CONDITION_LABELS,
  STATUS_LABELS,
  WORK_ORDER_EVENT_LABELS,
  WORK_ORDER_STATUS_LABELS,
  WORK_ORDER_PART_STATUS_LABELS,
  WORK_ORDER_TYPE_LABELS,
} from "@/lib/constants";
import { cn } from "@/lib/format";

const STATUS_STYLES = {
  DISPONIVEL: "bg-emerald-500/15 text-emerald-400 ring-emerald-500/30",
  RESERVADO: "bg-amber-500/15 text-amber-400 ring-amber-500/30",
  EM_TRANSITO: "bg-fuchsia-500/15 text-fuchsia-300 ring-fuchsia-500/30",
  VENDIDO: "bg-sky-500/15 text-sky-400 ring-sky-500/30",
  EM_REPARO: "bg-orange-500/15 text-orange-300 ring-orange-500/30",
  TRANSFERIDO: "bg-violet-500/15 text-violet-300 ring-violet-500/30",
  DEVOLVIDO: "bg-slate-500/20 text-slate-300 ring-slate-500/30",
  DESCARTADO: "bg-rose-500/15 text-rose-400 ring-rose-500/30",
};

const CONDITION_STYLES = {
  NOVO: "bg-cyan-500/15 text-cyan-300 ring-cyan-500/30",
  NOVO_COM_AVARIA: "bg-orange-500/15 text-orange-300 ring-orange-500/30",
  REVISADO: "bg-blue-500/15 text-blue-300 ring-blue-500/30",
};

export function Badge({ children, className }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1", className)}>
      {children}
    </span>
  );
}

export function StatusBadge({ status }) {
  return <Badge className={STATUS_STYLES[status] || "bg-surface-2 text-muted ring-border"}>{STATUS_LABELS[status] || status}</Badge>;
}

export function ConditionBadge({ condition }) {
  return (
    <Badge className={CONDITION_STYLES[condition] || "bg-surface-2 text-muted ring-border"}>
      {CONDITION_LABELS[condition] || condition}
    </Badge>
  );
}

const WORK_ORDER_STYLES = {
  ABERTA: "bg-sky-500/15 text-sky-300 ring-sky-500/30",
  EM_ANALISE: "bg-cyan-500/15 text-cyan-300 ring-cyan-500/30",
  AGUARDANDO_PECA: "bg-amber-500/15 text-amber-300 ring-amber-500/30",
  EM_REPARO: "bg-orange-500/15 text-orange-300 ring-orange-500/30",
  PRONTO: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30",
  ENTREGUE: "bg-slate-500/20 text-slate-300 ring-slate-500/30",
  SEM_REPARO: "bg-rose-500/15 text-rose-300 ring-rose-500/30",
  CANCELADA: "bg-rose-500/15 text-rose-300 ring-rose-500/30",
};

const PART_REQUEST_STYLES = {
  SOLICITADA: "bg-amber-500/15 text-amber-300 ring-amber-500/30",
  ATENDIDA: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30",
  RECUSADA: "bg-rose-500/15 text-rose-300 ring-rose-500/30",
};

export function WorkOrderTypeBadge({ type }) {
  const styles = {
    POS_VENDA: "bg-sky-500/15 text-sky-300 ring-sky-500/30",
    REPARO_ESTOQUE: "bg-amber-500/15 text-amber-300 ring-amber-500/30",
  };
  return (
    <Badge className={styles[type] || "bg-surface-2 text-muted ring-border"}>
      {WORK_ORDER_TYPE_LABELS[type] || type}
    </Badge>
  );
}

export function WorkOrderStatusBadge({ status }) {
  return (
    <Badge className={WORK_ORDER_STYLES[status] || "bg-surface-2 text-muted ring-border"}>
      {WORK_ORDER_STATUS_LABELS[status] || status}
    </Badge>
  );
}

export function PartRequestBadge({ status }) {
  return (
    <Badge className={PART_REQUEST_STYLES[status] || "bg-surface-2 text-muted ring-border"}>
      {WORK_ORDER_PART_STATUS_LABELS[status] || status}
    </Badge>
  );
}

const WORK_ORDER_EVENT_STYLES = {
  ABERTURA: "bg-sky-500/15 text-sky-300 ring-sky-500/30",
  STATUS: "bg-cyan-500/15 text-cyan-300 ring-cyan-500/30",
  ANALISE: "bg-violet-500/15 text-violet-300 ring-violet-500/30",
  APONTAMENTO: "bg-orange-500/15 text-orange-300 ring-orange-500/30",
  NOTA: "bg-slate-500/20 text-slate-300 ring-slate-500/30",
  ENTREGA: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30",
  LOCALIZACAO: "bg-amber-500/15 text-amber-300 ring-amber-500/30",
  PECA_SOLICITADA: "bg-fuchsia-500/15 text-fuchsia-300 ring-fuchsia-500/30",
  EVIDENCIA: "bg-pink-500/15 text-pink-300 ring-pink-500/30",
};

export function WorkOrderEventBadge({ type }) {
  return (
    <Badge className={WORK_ORDER_EVENT_STYLES[type] || "bg-surface-2 text-muted ring-border"}>
      {WORK_ORDER_EVENT_LABELS[type] || type}
    </Badge>
  );
}
