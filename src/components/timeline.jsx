import Link from "next/link";
import { MOVEMENT_TYPE_LABELS, STATUS_LABELS } from "@/lib/constants";
import { formatDateTime, formatLocationPath } from "@/lib/format";

const SALE_ORDER_PATTERN = /(VD-\d{6,})/gi;

function ObservationText({ text }) {
  const value = String(text || "");
  const parts = value.split(SALE_ORDER_PATTERN);
  if (parts.length === 1) return value;

  return parts.map((part, index) => {
    const match = part.match(/^VD-(\d{6,})$/i);
    if (!match) return <span key={`${index}-${part}`}>{part}</span>;
    const saleId = Number(match[1]);
    if (!Number.isInteger(saleId) || saleId <= 0) return <span key={`${index}-${part}`}>{part}</span>;
    return (
      <Link key={`${index}-${part}`} href={`/vendas/${saleId}`} className="font-medium text-accent hover:underline">
        {part.toUpperCase()}
      </Link>
    );
  });
}

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
          ) : ["TRANSFERENCIA_ENVIO", "TRANSFERENCIA_RECEBIMENTO", "TRANSFERENCIA_CANCELADA", "TRANSFERENCIA_RECUSADA"].includes(item.type) ? (
            <p className="mt-1 text-xs text-muted">
              {item.previousUnit?.name || "—"} → {item.newUnit?.name || "—"}
              {` · ${STATUS_LABELS[item.previousStatus] || item.previousStatus || "—"} → ${STATUS_LABELS[item.newStatus] || item.newStatus || "—"}`}
            </p>
          ) : item.type === "ENTRADA" && item.newLocation ? (
            <p className="mt-1 text-xs text-muted">{formatLocationPath(item.newLocation)}</p>
          ) : item.previousStatus || item.newStatus ? (
            <p className="mt-1 text-xs text-muted">
              {STATUS_LABELS[item.previousStatus] || item.previousStatus || "—"} → {STATUS_LABELS[item.newStatus] || item.newStatus || "—"}
            </p>
          ) : null}
          {item.observation && item.type !== "ALTERACAO_LOCALIZACAO" ? (
            <p className="mt-1 text-sm">
              <ObservationText text={item.observation} />
            </p>
          ) : null}
        </li>
      ))}
    </ol>
  );
}
