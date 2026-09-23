"use client";

import { useEffect, useState } from "react";
import { Button, Field, Textarea } from "@/components/ui";
import { Modal } from "@/components/modal";

export function ProductTrashDialog({ open, count = 1, loading, onConfirm, onClose }) {
  const [observation, setObservation] = useState("");
  const many = count > 1;

  useEffect(() => {
    if (!open) setObservation("");
  }, [open]);

  function close() {
    if (loading) return;
    setObservation("");
    onClose?.();
  }

  return (
    <Modal
      open={open}
      title={many ? `Mover ${count} produtos para a lixeira` : "Mover para a lixeira"}
      onClose={close}
      footer={
        <>
          <Button variant="secondary" onClick={close} type="button" disabled={loading}>
            Cancelar
          </Button>
          <Button
            variant="danger"
            type="button"
            disabled={loading}
            onClick={() => onConfirm?.(observation)}
          >
            {loading ? "Aguarde..." : "Mover para a lixeira"}
          </Button>
        </>
      }
    >
      <p className="mb-4 text-sm text-muted">
        {many
          ? "Os aparelhos saem do estoque, dashboards e buscas. Dá para restaurar depois na Lixeira."
          : "O aparelho sai do estoque, dashboards e buscas. Dá para restaurar depois na Lixeira."}
      </p>
      <Field label="Motivo (opcional)">
        <Textarea
          value={observation}
          onChange={(event) => setObservation(event.target.value)}
          placeholder="Cadastro duplicado, lançamento indevido..."
          rows={3}
        />
      </Field>
    </Modal>
  );
}
