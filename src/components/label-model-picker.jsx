"use client";

import { Button } from "@/components/ui";
import { Modal } from "@/components/modal";
import { LABEL_MODELS, LABEL_MODEL_OPTIONS } from "@/lib/constants";

export function LabelModelPicker({ open, onClose, onSelect }) {
  return (
    <Modal
      open={open}
      title="Escolher modelo de etiqueta"
      onClose={onClose}
      className="max-w-md"
      footer={
        <Button type="button" variant="secondary" onClick={onClose}>
          Cancelar
        </Button>
      }
    >
      <p className="mb-4 text-sm text-muted">Selecione o modelo que será impresso.</p>
      <div className="grid gap-2">
        {LABEL_MODEL_OPTIONS.map((option) => (
          <button
            key={option.id}
            type="button"
            className="rounded-xl border border-border bg-surface-2 px-4 py-3 text-left transition hover:border-accent hover:bg-accent/10"
            onClick={() => onSelect(option.id)}
          >
            <p className="text-sm font-semibold">{option.label}</p>
            <p className="mt-1 text-xs text-muted">{option.description}</p>
          </button>
        ))}
      </div>
    </Modal>
  );
}

export function openLabelPrint({ productIds, model }) {
  const ids = (productIds || []).filter(Boolean);
  if (!ids.length) return;
  const modelo = model || LABEL_MODELS.PRECOS_01;
  if (ids.length === 1) {
    window.open(`/estoque/${ids[0]}/etiqueta?modelo=${modelo}`, "_blank");
    return;
  }
  window.open(`/estoque/etiquetas?ids=${ids.join(",")}&modelo=${modelo}`, "_blank");
}
