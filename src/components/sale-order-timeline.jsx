"use client";

import { SaleOrderEventBadge } from "@/components/badges";
import { cn, formatDateTime } from "@/lib/format";

export function SaleOrderTimeline({ events = [] }) {
  if (!events.length) {
    return <p className="px-5 py-8 text-sm text-muted">Nenhuma interação registrada ainda.</p>;
  }

  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full table-fixed text-left text-sm">
        <colgroup>
          <col className="w-[180px]" />
          <col />
        </colgroup>
        <thead className="text-xs uppercase tracking-wide text-muted">
          <tr>
            <th className="px-5 py-3 font-semibold">Quando</th>
            <th className="px-5 py-3 font-semibold">Interação</th>
          </tr>
        </thead>
        <tbody>
          {events.map((event, index) => {
            const latest = index === 0;
            return (
              <tr
                key={event.id}
                className={cn(
                  "border-t border-border align-top",
                  latest ? "bg-accent/10" : "hover:bg-surface-2/80",
                )}
              >
                <td className={cn("px-5 py-5", latest ? "border-l-2 border-l-accent" : "")}>
                  <p className="font-medium">{formatDateTime(event.createdAt)}</p>
                  <p className="mt-1 text-xs text-muted">{event.user?.name || "Sistema"}</p>
                  {latest ? (
                    <p className="mt-2 text-[11px] font-semibold uppercase tracking-wide text-accent">Mais recente</p>
                  ) : null}
                </td>
                <td className="px-5 py-5">
                  <div className="mb-2.5">
                    <SaleOrderEventBadge type={event.type} />
                  </div>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">{event.message}</p>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
