"use client";

import { useEffect } from "react";
import { Button } from "./ui";

export function Modal({ open, title, children, onClose, footer }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => {
      if (event.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-6">
      <button className="absolute inset-0" onClick={onClose} aria-label="Fechar" />
      <div className="relative z-10 w-full max-w-lg rounded-t-2xl border border-border bg-surface p-5 shadow-2xl sm:rounded-2xl">
        {title ? <h2 className="mb-4 text-lg font-semibold">{title}</h2> : null}
        {children}
        {footer ? <div className="mt-5 flex justify-end gap-2">{footer}</div> : null}
      </div>
    </div>
  );
}

export function ConfirmDialog({ open, title, message, confirmLabel = "Confirmar", danger, loading, onConfirm, onClose }) {
  return (
    <Modal
      open={open}
      title={title}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} type="button">
            Cancelar
          </Button>
          <Button variant={danger ? "danger" : "primary"} onClick={onConfirm} disabled={loading} type="button">
            {loading ? "Aguarde..." : confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-sm text-muted">{message}</p>
    </Modal>
  );
}
