"use client";

import { useState } from "react";
import { WorkOrderEventBadge } from "@/components/badges";
import { cn, formatDateTime } from "@/lib/format";

export function WorkOrderTimeline({ events = [] }) {
  const [lightbox, setLightbox] = useState(null);

  if (!events.length) {
    return <p className="px-5 py-8 text-sm text-muted">Nenhuma interação registrada ainda.</p>;
  }

  return (
    <>
      <div className="w-full overflow-x-auto">
        <table className="w-full table-fixed text-left text-sm">
          <colgroup>
            <col className="w-[180px]" />
            <col />
            <col className="w-[280px]" />
          </colgroup>
          <thead className="text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-5 py-3 font-semibold">Quando</th>
              <th className="px-5 py-3 font-semibold">Interação</th>
              <th className="px-5 py-3 font-semibold">Evidências</th>
            </tr>
          </thead>
          <tbody>
            {events.map((event, index) => {
              const latest = index === 0;
              const images = event.images || [];
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
                      <WorkOrderEventBadge type={event.type} />
                    </div>
                    <p className="whitespace-pre-wrap text-sm leading-relaxed">{event.message}</p>
                  </td>
                  <td className="px-5 py-5">
                    {images.length ? (
                      <div className="flex flex-wrap gap-2">
                        {images.map((image) => (
                          <button
                            key={image.id}
                            type="button"
                            className="overflow-hidden rounded-xl border border-border shadow-sm"
                            onClick={() => setLightbox(image)}
                          >
                            <img src={image.fileUrl} alt="" className="h-20 w-20 object-cover sm:h-24 sm:w-24" />
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted">Sem evidência</p>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {lightbox ? (
        <button
          type="button"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6"
          onClick={() => setLightbox(null)}
        >
          <img src={lightbox.fileUrl} alt="" className="max-h-full max-w-full rounded-xl object-contain" />
        </button>
      ) : null}
    </>
  );
}
