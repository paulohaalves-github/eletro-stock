"use client";

import { useRef, useState } from "react";
import { uploadWithProgress } from "@/lib/api-client";
import { Button } from "./ui";

export function ImagePicker({ files, onChange, requiredHint }) {
  const inputRef = useRef(null);
  const cameraRef = useRef(null);

  function addFiles(list) {
    const next = [...files, ...Array.from(list || [])];
    onChange(next);
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="secondary" onClick={() => cameraRef.current?.click()}>
          Tirar foto
        </Button>
        <Button type="button" variant="secondary" onClick={() => inputRef.current?.click()}>
          Selecionar arquivos
        </Button>
      </div>
      <input
        ref={cameraRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        className="hidden"
        onChange={(event) => {
          addFiles(event.target.files);
          event.target.value = "";
        }}
      />
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="hidden"
        onChange={(event) => {
          addFiles(event.target.files);
          event.target.value = "";
        }}
      />
      {requiredHint ? <p className="mt-2 text-sm text-warning">{requiredHint}</p> : null}
      {files.length ? (
        <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
          {files.map((file, index) => (
            <div key={`${file.name}-${index}`} className="relative overflow-hidden rounded-xl border border-border">
              <img src={URL.createObjectURL(file)} alt="" className="h-24 w-full object-cover" />
              <button
                type="button"
                className="absolute right-1 top-1 rounded-md bg-black/70 px-1.5 text-xs text-white"
                onClick={() => onChange(files.filter((_, i) => i !== index))}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function RemoteGallery({ product, canEdit, onChanged }) {
  const [lightbox, setLightbox] = useState(null);
  const [progress, setProgress] = useState(null);
  const inputRef = useRef(null);
  const cameraRef = useRef(null);

  async function upload(list) {
    const form = new FormData();
    Array.from(list || []).forEach((file) => form.append("files", file));
    setProgress(0);
    try {
      await uploadWithProgress(`/api/products/${product.id}/images`, form, setProgress);
      onChanged?.();
    } finally {
      setProgress(null);
    }
  }

  async function remove(image) {
    await fetch(`/api/products/${product.id}/images/${image.id}`, { method: "DELETE" });
    onChanged?.();
  }

  async function makePrimary(image) {
    await fetch(`/api/products/${product.id}/images/${image.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isPrimary: true }),
    });
    onChanged?.();
  }

  return (
    <div>
      {canEdit ? (
        <div className="mb-3 flex flex-wrap gap-2">
          <Button type="button" variant="secondary" onClick={() => cameraRef.current?.click()}>
            Tirar foto
          </Button>
          <Button type="button" variant="secondary" onClick={() => inputRef.current?.click()}>
            Adicionar fotos
          </Button>
          <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => upload(e.target.files)} />
          <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={(e) => upload(e.target.files)} />
        </div>
      ) : null}
      {progress != null ? (
        <div className="mb-3 h-2 overflow-hidden rounded-full bg-surface-2">
          <div className="h-full bg-accent transition-all" style={{ width: `${progress}%` }} />
        </div>
      ) : null}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {product.images?.map((image) => (
          <div key={image.id} className="overflow-hidden rounded-xl border border-border">
            <button type="button" className="block w-full" onClick={() => setLightbox(image)}>
              <img src={image.fileUrl} alt="" className="h-32 w-full object-cover" />
            </button>
            <div className="flex items-center justify-between px-2 py-1.5 text-[11px] text-muted">
              <span>{image.isPrimary ? "Principal" : new Date(image.createdAt).toLocaleString("pt-BR")}</span>
              {canEdit ? (
                <span className="flex gap-2">
                  {!image.isPrimary ? (
                    <button type="button" className="text-accent" onClick={() => makePrimary(image)}>
                      Principal
                    </button>
                  ) : null}
                  <button type="button" className="text-danger" onClick={() => remove(image)}>
                    Excluir
                  </button>
                </span>
              ) : null}
            </div>
          </div>
        ))}
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
    </div>
  );
}
