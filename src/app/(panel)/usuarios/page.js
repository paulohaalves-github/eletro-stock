"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api-client";
import { Button, Card, Field, Input, PageHeader, Select } from "@/components/ui";
import { ROLE_LABELS, ROLES, UNIT_TYPE_LABELS } from "@/lib/constants";

const emptyForm = { name: "", email: "", password: "", role: ROLES.STOCK, unitIds: [] };

export default function UsuariosPage() {
  const [items, setItems] = useState([]);
  const [units, setUnits] = useState([]);
  const [form, setForm] = useState(emptyForm);

  async function load() {
    const [users, unitData] = await Promise.all([api("/api/users"), api("/api/units")]);
    setItems(users.items || []);
    setUnits(unitData.items || []);
  }

  useEffect(() => {
    void load().catch((error) => toast.error(error.message));
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

  async function create(event) {
    event.preventDefault();
    try {
      const data = await api("/api/users", { method: "POST", json: form });
      toast.success(data.message);
      setForm(emptyForm);
      load();
    } catch (error) {
      toast.error(error.message);
    }
  }

  async function toggle(user) {
    try {
      await api(`/api/users/${user.id}`, { method: "PATCH", json: { active: !user.active } });
      toast.success("Usuário atualizado.");
      load();
    } catch (error) {
      toast.error(error.message);
    }
  }

  async function saveUnits(user, unitIds) {
    try {
      await api(`/api/users/${user.id}`, { method: "PATCH", json: { unitIds } });
      toast.success("Unidades atualizadas.");
      load();
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
    <div>
      <PageHeader title="Usuários" subtitle="O administrador vê todas as unidades. Os demais perfis só operam nas lojas vinculadas." />
      <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
        <Card>
          <form onSubmit={create} className="space-y-3">
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
            <Button>Cadastrar</Button>
          </form>
        </Card>
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase text-muted">
              <tr>
                <th className="px-4 py-3 text-left">Nome</th>
                <th className="px-4 py-3 text-left">E-mail</th>
                <th className="px-4 py-3 text-left">Perfil</th>
                <th className="px-4 py-3 text-left">Unidades</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((user) => (
                <tr key={user.id} className="border-t border-border">
                  <td className="px-4 py-3">{user.name}</td>
                  <td className="px-4 py-3">{user.email}</td>
                  <td className="px-4 py-3">{ROLE_LABELS[user.role]}</td>
                  <td className="px-4 py-3">
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
                  <td className="px-4 py-3">{user.active ? "Ativo" : "Inativo"}</td>
                  <td className="px-4 py-3 text-right">
                    <Button variant="ghost" onClick={() => toggle(user)}>{user.active ? "Desativar" : "Ativar"}</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  );
}
