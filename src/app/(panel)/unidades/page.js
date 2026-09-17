"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { api } from "@/lib/api-client";
import { Button, Card, Field, Input, PageHeader, Select } from "@/components/ui";
import { LoadMore, SearchActions } from "@/components/paged-list";
import { Modal } from "@/components/modal";
import { UNIT_TYPE_LABELS, UNIT_TYPES } from "@/lib/constants";
import { listQuery } from "@/lib/pagination";
import { usePagedList } from "@/hooks/use-paged-list";

export default function UnidadesPage() {
  const router = useRouter();
  const list = usePagedList();
  const [q, setQ] = useState("");
  const [form, setForm] = useState({ name: "", type: UNIT_TYPES.BRANCH });
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  function loader(page, pageSize) {
    return api(`/api/units?all=1&${listQuery({ q }, page, pageSize)}`);
  }

  useEffect(() => {
    void list.search(loader).catch((error) => toast.error(error.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function closeModal() {
    if (saving) return;
    setOpen(false);
    setForm({ name: "", type: UNIT_TYPES.BRANCH });
  }

  async function create(event) {
    event.preventDefault();
    setSaving(true);
    try {
      const data = await api("/api/units", { method: "POST", json: form });
      toast.success(data.message);
      setForm({ name: "", type: UNIT_TYPES.BRANCH });
      setOpen(false);
      await list.search(loader);
      router.refresh();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  }

  async function save(item, payload) {
    try {
      const data = await api(`/api/units/${item.id}`, { method: "PATCH", json: payload });
      toast.success(data.message);
      await list.search(loader);
      router.refresh();
    } catch (error) {
      toast.error(error.message);
    }
  }

  return (
    <div className="w-full">
      <PageHeader
        title="Unidades"
        subtitle="Cadastre matriz, filiais e o laboratório do grupo. O administrador vê todas as ativas; os demais perfis precisam ser vinculados."
        actions={<Button onClick={() => { setForm({ name: "", type: UNIT_TYPES.BRANCH }); setOpen(true); }}>Nova unidade</Button>}
      />
      <Card className="mb-4 space-y-3">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar unidade" />
        <SearchActions loading={list.loading} onSearch={() => void list.search(loader)} />
      </Card>
      <Card className="w-full overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-5 py-3 font-semibold">Nome</th>
                <th className="px-5 py-3 font-semibold">Tipo</th>
                <th className="px-5 py-3 font-semibold">Identificador</th>
                <th className="px-5 py-3 font-semibold">Status</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {list.items.map((item) => (
                <UnitRow key={item.id} item={item} onSave={save} />
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <LoadMore shown={list.items.length} total={list.total} hasMore={list.hasMore} loading={list.loadingMore} onClick={() => void list.loadMore()} />

      <Modal
        open={open}
        title="Nova unidade"
        onClose={closeModal}
        footer={
          <>
            <Button type="button" variant="secondary" onClick={closeModal} disabled={saving}>Cancelar</Button>
            <Button type="submit" form="unit-form" disabled={saving || !form.name.trim()}>{saving ? "Salvando..." : "Cadastrar"}</Button>
          </>
        }
      >
        <form id="unit-form" onSubmit={create} className="space-y-3">
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
        </form>
      </Modal>
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
    <tr className="border-t border-border align-top hover:bg-surface-2/80">
      <td className="px-5 py-4">
        <Input value={name} onChange={(e) => setName(e.target.value)} />
      </td>
      <td className="px-5 py-4">
        <Select value={type} onChange={(e) => setType(e.target.value)}>
          {Object.entries(UNIT_TYPE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </Select>
      </td>
      <td className="px-5 py-4 text-muted">{item.slug}</td>
      <td className="px-5 py-4 text-muted">{item.active ? "Ativa" : "Inativa"}</td>
      <td className="px-5 py-4 text-right">
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="secondary" disabled={!dirty} onClick={() => onSave(item, { name, type })}>
            Salvar
          </Button>
          <Button variant="ghost" onClick={() => onSave(item, { active: !item.active })}>
            {item.active ? "Desativar" : "Ativar"}
          </Button>
        </div>
      </td>
    </tr>
  );
}
