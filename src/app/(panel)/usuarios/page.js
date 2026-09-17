"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api-client";
import { Button, Card, Field, Input, PageHeader, Select } from "@/components/ui";
import { LoadMore, SearchActions } from "@/components/paged-list";
import { Modal } from "@/components/modal";
import { ROLE_LABELS, ROLES, UNIT_TYPE_LABELS } from "@/lib/constants";
import { listQuery } from "@/lib/pagination";
import { usePagedList } from "@/hooks/use-paged-list";

const emptyForm = { name: "", email: "", password: "", role: ROLES.STOCK, unitIds: [] };

export default function UsuariosPage() {
  const list = usePagedList();
  const [q, setQ] = useState("");
  const [units, setUnits] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  function loader(page, pageSize) {
    return api(`/api/users?${listQuery({ q }, page, pageSize)}`);
  }

  async function loadUnits() {
    const unitData = await api("/api/units");
    setUnits(unitData.items || []);
  }

  useEffect(() => {
    void loadUnits().catch((error) => toast.error(error.message));
    void list.search(loader);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggleFormUnit(unitId) {
    setForm((current) => {
      const has = current.unitIds.includes(unitId);
      return {
        ...current,
        unitIds: has ? current.unitIds.filter((id) => id !== unitId) : [...current.unitIds, unitId],
      };
    });
  }

  function closeModal() {
    if (saving) return;
    setOpen(false);
    setForm(emptyForm);
  }

  async function create(event) {
    event.preventDefault();
    setSaving(true);
    try {
      const data = await api("/api/users", { method: "POST", json: form });
      toast.success(data.message);
      setForm(emptyForm);
      setOpen(false);
      void list.search(loader);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  }

  async function toggle(user) {
    try {
      await api(`/api/users/${user.id}`, { method: "PATCH", json: { active: !user.active } });
      toast.success("Usuário atualizado.");
      void list.search(loader);
    } catch (error) {
      toast.error(error.message);
    }
  }

  async function saveUnits(user, unitIds) {
    try {
      await api(`/api/users/${user.id}`, { method: "PATCH", json: { unitIds } });
      toast.success("Unidades atualizadas.");
      void list.search(loader);
    } catch (error) {
      toast.error(error.message);
    }
  }

  function toggleUserUnit(user, unitId) {
    const current = user.unitIds || [];
    const next = current.includes(unitId) ? current.filter((id) => id !== unitId) : [...current, unitId];
    saveUnits(user, next);
  }

  return (
    <div className="w-full">
      <PageHeader
        title="Usuários"
        subtitle="O administrador vê todas as unidades. Os demais perfis só operam nas lojas vinculadas."
        actions={<Button onClick={() => { setForm(emptyForm); setOpen(true); }}>Novo usuário</Button>}
      />
      <Card className="mb-4 space-y-3">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nome ou e-mail" />
        <SearchActions loading={list.loading} onSearch={() => void list.search(loader)} />
      </Card>
      <Card className="w-full overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-5 py-3 font-semibold">Nome</th>
                <th className="px-5 py-3 font-semibold">E-mail</th>
                <th className="px-5 py-3 font-semibold">Perfil</th>
                <th className="px-5 py-3 font-semibold">Unidades</th>
                <th className="px-5 py-3 font-semibold">Status</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {list.items.map((user) => (
                <tr key={user.id} className="border-t border-border align-top hover:bg-surface-2/80">
                  <td className="px-5 py-4 font-medium">{user.name}</td>
                  <td className="px-5 py-4">{user.email}</td>
                  <td className="px-5 py-4">{ROLE_LABELS[user.role]}</td>
                  <td className="px-5 py-4">
                    {user.role === ROLES.ADMIN ? (
                      <span className="text-muted">Todas</span>
                    ) : (
                      <div className="space-y-1">
                        {units.map((unit) => (
                          <label key={unit.id} className="flex items-center gap-2 text-xs">
                            <input
                              type="checkbox"
                              checked={(user.unitIds || []).includes(unit.id)}
                              onChange={() => toggleUserUnit(user, unit.id)}
                            />
                            {unit.name}
                          </label>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-5 py-4">{user.active ? "Ativo" : "Inativo"}</td>
                  <td className="px-5 py-4 text-right">
                    <Button variant="ghost" onClick={() => toggle(user)}>{user.active ? "Desativar" : "Ativar"}</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <LoadMore shown={list.items.length} total={list.total} hasMore={list.hasMore} loading={list.loadingMore} onClick={() => void list.loadMore()} />

      <Modal
        open={open}
        title="Novo usuário"
        onClose={closeModal}
        className="max-w-xl"
        footer={
          <>
            <Button type="button" variant="secondary" onClick={closeModal} disabled={saving}>Cancelar</Button>
            <Button type="submit" form="user-form" disabled={saving}>{saving ? "Salvando..." : "Cadastrar"}</Button>
          </>
        }
      >
        <form id="user-form" onSubmit={create} className="space-y-3">
          <Field label="Nome"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="E-mail"><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
          <Field label="Senha"><Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></Field>
          <Field label="Perfil">
            <Select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              {Object.entries(ROLE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </Select>
          </Field>
          <Field label="Unidades">
            {form.role === ROLES.ADMIN ? (
              <p className="text-sm text-muted">Administrador acessa todas as unidades automaticamente.</p>
            ) : (
              <div className="space-y-2">
                {units.map((unit) => (
                  <label key={unit.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={form.unitIds.includes(unit.id)}
                      onChange={() => toggleFormUnit(unit.id)}
                    />
                    {unit.name} ({UNIT_TYPE_LABELS[unit.type] || unit.type})
                  </label>
                ))}
              </div>
            )}
          </Field>
        </form>
      </Modal>
    </div>
  );
}
