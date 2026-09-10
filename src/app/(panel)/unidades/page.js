"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { api } from "@/lib/api-client";
import { Button, Card, Field, Input, PageHeader, Select } from "@/components/ui";
import { UNIT_TYPE_LABELS, UNIT_TYPES } from "@/lib/constants";

export default function UnidadesPage() {
  const router = useRouter();
  const [items, setItems] = useState([]);
  const [form, setForm] = useState({ name: "", type: UNIT_TYPES.BRANCH });

  async function load() {
    const data = await api("/api/units?all=1");
    setItems(data.items || []);
  }

  useEffect(() => {
    void load().catch((error) => toast.error(error.message));
  }, []);

  async function create(event) {
    event.preventDefault();
    try {
      const data = await api("/api/units", { method: "POST", json: form });
      toast.success(data.message);
      setForm({ name: "", type: UNIT_TYPES.BRANCH });
      await load();
      router.refresh();
    } catch (error) {
      toast.error(error.message);
    }
  }

  async function save(item, payload) {
    try {
      const data = await api(`/api/units/${item.id}`, { method: "PATCH", json: payload });
      toast.success(data.message);
      await load();
      router.refresh();
    } catch (error) {
      toast.error(error.message);
    }
  }

  return (
    <div>
      <PageHeader
        title="Unidades"
        subtitle="Cadastre filiais e matrizes. O administrador vê todas as ativas; os demais perfis precisam ser vinculados."
      />
      <Card className="mb-4">
        <form onSubmit={create} className="grid gap-3 sm:grid-cols-[1fr_180px_auto] sm:items-end">
          <Field label="Nome da unidade" required>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Ex.: Shopping Recife Outlet"
            />
          </Field>
          <Field label="Tipo">
            <Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              {Object.entries(UNIT_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </Select>
          </Field>
          <Button>Cadastrar</Button>
        </form>
      </Card>
      <div className="grid gap-2">
        {items.map((item) => (
          <UnitRow key={item.id} item={item} onSave={save} />
        ))}
      </div>
    </div>
  );
}

function UnitRow({ item, onSave }) {
  const [name, setName] = useState(item.name);
  const [type, setType] = useState(item.type);
  const dirty = name.trim() !== item.name || type !== item.type;

  useEffect(() => {
    setName(item.name);
    setType(item.type);
  }, [item.name, item.type]);

  return (
    <Card className="grid gap-3 p-4 sm:grid-cols-[1fr_auto] sm:items-center">
      <div className="grid gap-3 sm:grid-cols-[1fr_160px]">
        <Field label="Nome">
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Tipo">
          <Select value={type} onChange={(e) => setType(e.target.value)}>
            {Object.entries(UNIT_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </Select>
        </Field>
        <p className="text-xs text-muted sm:col-span-2">
          {item.active ? "Ativa" : "Inativa"} · identificador {item.slug}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" disabled={!dirty} onClick={() => onSave(item, { name, type })}>
          Salvar
        </Button>
        <Button variant="ghost" onClick={() => onSave(item, { active: !item.active })}>
          {item.active ? "Desativar" : "Ativar"}
        </Button>
      </div>
    </Card>
  );
}
