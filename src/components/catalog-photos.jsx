"use client";

import { useState } from "react";

export function CatalogGallery({ imageIds, alt }) {
  const ids = imageIds || [];
  const [active, setActive] = useState(ids[0] || null);
  if (!ids.length) {
    return (
      <div className="flex min-h-72 items-center justify-center rounded-2xl border border-border bg-white">
        <span className="text-sm text-muted">Sem foto</span>
      </div>
    );
  }
  const current = ids.includes(active) ? active : ids[0];
  return (
    <div className="space-y-3">
      <div className="flex min-h-72 items-center justify-center rounded-2xl border border-border bg-white">
        <img src={`/api/catalog/commercial/${current}`} alt={alt || ""} className="max-h-[28rem] w-full object-contain" />
      </div>
      {ids.length > 1 ? (
        <div className="flex gap-2 overflow-x-auto">
          {ids.map((id) => (
            <button
              key={id}
              type="button"
              className={`h-16 w-16 shrink-0 overflow-hidden rounded-xl border bg-white ${id === current ? "border-[#0482a4]" : "border-border"}`}
              onClick={() => setActive(id)}
            >
              <img src={`/api/catalog/commercial/${id}`} alt="" className="h-full w-full object-contain" />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function EvidencePhotos({ imageIds }) {
  const ids = imageIds || [];
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  if (!ids.length) return null;
  const current = ids[index] || ids[0];
  return (
    <>
      <button
        type="button"
        className="mt-3 inline-flex rounded-full border border-[#0482a4] px-3 py-1.5 text-xs font-semibold text-[#0482a4]"
        onClick={() => {
          setIndex(0);
          setOpen(true);
        }}
      >
        Ver fotos do aparelho
      </button>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" role="dialog">
          <div className="w-full max-w-3xl">
            <img src={`/api/catalog/media/${current}`} alt="" className="max-h-[70vh] w-full rounded-xl bg-white object-contain" />
            <div className="mt-3 flex items-center justify-between gap-3 text-sm text-white">
              <button type="button" className="rounded-full bg-white/15 px-3 py-1.5" onClick={() => setIndex((value) => (value - 1 + ids.length) % ids.length)} disabled={ids.length < 2}>
                Anterior
              </button>
              <span>{index + 1} de {ids.length}</span>
              <button type="button" className="rounded-full bg-white/15 px-3 py-1.5" onClick={() => setIndex((value) => (value + 1) % ids.length)} disabled={ids.length < 2}>
                Próxima
              </button>
              <button type="button" className="rounded-full bg-white px-3 py-1.5 font-semibold text-[#05061a]" onClick={() => setOpen(false)}>
                Fechar
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
