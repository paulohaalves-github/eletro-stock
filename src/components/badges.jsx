import { CONDITION_LABELS, STATUS_LABELS } from "@/lib/constants";
import { cn } from "@/lib/format";

const STATUS_STYLES = {
  DISPONIVEL: "bg-emerald-500/15 text-emerald-400 ring-emerald-500/30",
  RESERVADO: "bg-amber-500/15 text-amber-400 ring-amber-500/30",
  VENDIDO: "bg-sky-500/15 text-sky-400 ring-sky-500/30",
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
