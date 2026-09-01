"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api-client";
import { Button, Card, Field, Input, PageHeader, Select } from "@/components/ui";
import { ROLE_LABELS, ROLES } from "@/lib/constants";

export default function UsuariosPage() {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState({ name: "", email: "", password: "", role: ROLES.STOCK });

  async function load() {
    const data = await api("/api/users");
    setItems(data.items || []);
  }

  useEffect(() => {
    void load().catch((error) => toast.error(error.message));
  }, []);

  async function create(event) {
    event.preventDefault();
    try {
      const data = await api("/api/users", { method: "POST", json: form });
      toast.success(data.message);
      setForm({ name: "", email: "", password: "", role: ROLES.STOCK });
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

  return (
    <div>
      <PageHeader title="Usuários" subtitle="Administrador, Gestor, Estoque e Consulta." />
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
