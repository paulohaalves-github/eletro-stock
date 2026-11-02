"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api-client";
import { Button, Field, Input, Select } from "@/components/ui";
import { Modal } from "@/components/modal";
import { CONDITION_LABELS, VOLTAGE_LABELS } from "@/lib/constants";

const EMPTY = {
  commercialName: "",
  modelCode: "",
  capacity: "",
  voltage: "",
  condition: "",
  categoryId: "",
  lineId: "",
};

export function WaitlistDialog({ open, initial, onClose, onSave, saving }) {
  const [form, setForm] = useState(EMPTY);
  const [categories, setCategories] = useState([]);
  const [lines, setLines] = useState([]);

  useEffect(() => {
    if (!open) return;
    setForm({
      commercialName: initial?.waitlistCommercialName || initial?.commercialName || "",
      modelCode: initial?.waitlistModelCode || initial?.modelCode || "",
      capacity: initial?.waitlistCapacity || initial?.capacity || "",
      voltage: initial?.waitlistVoltage || initial?.voltage || "",
      condition: initial?.waitlistCondition || initial?.condition || "",
      categoryId: initial?.waitlistCategoryId ? String(initial.waitlistCategoryId) : "",
      lineId: initial?.waitlistLineId ? String(initial.waitlistLineId) : "",
    });
    api("/api/categories?pageSize=200").then((data) => setCategories(data.items || [])).catch(() => {});
    api("/api/lines?pageSize=200").then((data) => setLines(data.items || [])).catch(() => {});
  }, [open, initial]);

  function set(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function submit(event) {
    event.preventDefault();
    if (!form.commercialName.trim() && !form.modelCode.trim()) {
      toast.error("Informe o nome comercial ou o Model Code.");
      return;
    }
    onSave(form);
  }

  return (
    <Modal
      open={open}
      title="Lista de Espera"
      onClose={() => !saving && onClose()}
      className="max-w-lg"
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button type="submit" form="waitlist-form" disabled={saving}>{saving ? "Salvando..." : "Salvar lista"}</Button>
        </>
      }
    >
      <form id="waitlist-form" onSubmit={submit} className="space-y-3">
        <p className="text-sm text-muted">Preencha o que o cliente procura. Campo vazio não restringe a busca.</p>
        <Field label="Nome comercial">
          <Input value={form.commercialName} onChange={(e) => set("commercialName", e.target.value)} placeholder="Ex.: Geladeira Brastemp" />
        </Field>
        <Field label="Model Code">
          <Input value={form.modelCode} onChange={(e) => set("modelCode", e.target.value)} placeholder="Opcional, quando o código for conhecido" />
        </Field>
        <Field label="Capacidade">
          <Input value={form.capacity} onChange={(e) => set("capacity", e.target.value)} placeholder="12 kg, 128 GB, 55 polegadas" />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Voltagem">
            <Select value={form.voltage} onChange={(e) => set("voltage", e.target.value)}>
              <option value="">Qualquer</option>
              {Object.entries(VOLTAGE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </Select>
          </Field>
          <Field label="Condição">
            <Select value={form.condition} onChange={(e) => set("condition", e.target.value)}>
              <option value="">Qualquer</option>
              {Object.entries(CONDITION_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </Select>
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Categoria">
            <Select value={form.categoryId} onChange={(e) => set("categoryId", e.target.value)}>
              <option value="">Qualquer</option>
              {categories.map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </Select>
          </Field>
          <Field label="Linha">
            <Select value={form.lineId} onChange={(e) => set("lineId", e.target.value)}>
              <option value="">Qualquer</option>
              {lines.map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </Select>
          </Field>
        </div>
      </form>
    </Modal>
  );
}
