import { MOVEMENT_TYPE_LABELS, STATUS_LABELS } from "@/lib/constants";
import { formatDateTime, formatLocationPath } from "@/lib/format";

export function Timeline({ items = [] }) {
  if (!items.length) {
    return <p className="text-sm text-muted">Nenhuma movimentação registrada.</p>;
  }

  return (
    <ol className="space-y-4">
      {items.map((item) => (
        <li key={item.id} className="relative border-l border-border pl-4">
          <span className="absolute -left-1.5 top-1.5 h-3 w-3 rounded-full bg-accent" />
          <p className="text-sm font-medium">{MOVEMENT_TYPE_LABELS[item.type] || item.type}</p>
          <p className="text-xs text-muted">{formatDateTime(item.createdAt)} · {item.user?.name || "Sistema"}</p>
          {item.type === "ALTERACAO_LOCALIZACAO" ? (
            <p className="mt-1 text-xs text-muted">
              {formatLocationPath(item.previousLocation) || "sem localização"} → {formatLocationPath(item.newLocation) || "sem localização"}
            </p>
          ) : item.type === "ENTRADA" && item.newLocation ? (
            <p className="mt-1 text-xs text-muted">{formatLocationPath(item.newLocation)}</p>
          ) : item.previousStatus || item.newStatus ? (
            <p className="mt-1 text-xs text-muted">
              {STATUS_LABELS[item.previousStatus] || item.previousStatus || "—"} → {STATUS_LABELS[item.newStatus] || item.newStatus || "—"}
            </p>
          ) : null}
          {item.observation && item.type !== "ALTERACAO_LOCALIZACAO" ? <p className="mt-1 text-sm">{item.observation}</p> : null}
        </li>
      ))}
    </ol>
  );
}
