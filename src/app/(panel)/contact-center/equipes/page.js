"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api-client";
import { Button, Card, Field, Input, PageHeader, Select } from "@/components/ui";
import { Modal } from "@/components/modal";
import { INBOX_TEAM_MEMBER_ROLE_LABELS, INBOX_TEAM_MEMBER_ROLES } from "@/lib/constants";
import { can, PERMISSIONS } from "@/lib/permissions";

const empty = { name: "", color: "#22d3ee" };

export default function EquipesPage() {
  const [me, setMe] = useState(null);
  const [teams, setTeams] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState(null);
  const [selected, setSelected] = useState(null);
  const [memberRows, setMemberRows] = useState([]);

  const canManage = me && can(me.role, PERMISSIONS.INBOX_TEAM_MANAGE);

  async function load() {
    setLoading(true);
    try {
      const [{ user }, teamsData, usersData] = await Promise.all([
        api("/api/auth/me"),
        api("/api/inbox/teams"),
        api("/api/inbox/users").catch(() => ({ items: [] })),
      ]);
      setMe(user);
      setTeams(teamsData.items || []);
      setUsers(usersData.items || []);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function closeForm() {
    if (saving) return;
    setOpen(false);
    setEditing(null);
    setForm(empty);
  }

  async function saveTeam(event) {
    event.preventDefault();
    setSaving(true);
    try {
      if (editing) {
        await api(`/api/inbox/teams/${editing.id}`, { method: "PATCH", json: form });
        toast.success("Equipe atualizada.");
      } else {
        await api("/api/inbox/teams", { method: "POST", json: form });
        toast.success("Equipe cadastrada.");
      }
      closeForm();
      await load();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  }

  function openMembers(team) {
    setSelected(team);
    setMemberRows(
      (team.members || []).map((member) => ({
        userId: member.userId,
        role: member.role,
        conversationLimit: member.conversationLimit || 0,
      })),
    );
    setMembersOpen(true);
  }

  function addMemberRow() {
    const used = new Set(memberRows.map((row) => Number(row.userId)));
    const next = users.find((user) => !used.has(user.id));
    if (!next) {
      toast.error("Todos os usuários ativos já estão na equipe.");
      return;
    }
    setMemberRows((current) => [...current, { userId: next.id, role: INBOX_TEAM_MEMBER_ROLES.AGENT, conversationLimit: 0 }]);
  }

  async function saveMembers(event) {
    event.preventDefault();
    if (!selected) return;
    setSaving(true);
    try {
      await api(`/api/inbox/teams/${selected.id}`, { method: "PUT", json: { members: memberRows } });
      toast.success("Agentes atualizados.");
      setMembersOpen(false);
      await load();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(team) {
    try {
      await api(`/api/inbox/teams/${team.id}`, { method: "PATCH", json: { active: !team.active } });
      toast.success(team.active ? "Equipe desativada." : "Equipe ativada.");
      await load();
    } catch (error) {
      toast.error(error.message);
    }
  }

  return (
    <div className="w-full">
      <PageHeader
        title="Equipes"
        subtitle="Grupos de atendimento e os agentes que recebem as conversas."
        actions={canManage ? <Button onClick={() => { setEditing(null); setForm(empty); setOpen(true); }}>Nova equipe</Button> : null}
      />

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-5 py-3 font-semibold">Equipe</th>
                <th className="px-5 py-3 font-semibold">Agentes</th>
                <th className="px-5 py-3 font-semibold">Canais</th>
                <th className="px-5 py-3 font-semibold">Conversas</th>
                <th className="px-5 py-3 font-semibold">Status</th>
                <th className="px-5 py-3 font-semibold" />
              </tr>
            </thead>
            <tbody>
              {teams.map((team) => (
                <tr key={team.id} className="border-t border-border">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2 font-medium">
                      <span className="h-3 w-3 rounded-full" style={{ background: team.color }} />
                      {team.name}
                    </div>
                  </td>
                  <td className="px-5 py-4 text-muted">
                    {(team.members || []).length
                      ? team.members.map((member) => member.user?.name).filter(Boolean).join(", ")
                      : "Nenhum agente"}
                  </td>
                  <td className="px-5 py-4 text-muted">{team.channelCount}</td>
                  <td className="px-5 py-4 text-muted">{team.conversationCount}</td>
                  <td className="px-5 py-4 text-muted">{team.active ? "Ativa" : "Inativa"}</td>
                  <td className="px-5 py-4 text-right">
                    {canManage ? (
                      <div className="flex justify-end gap-2">
                        <Button variant="secondary" onClick={() => openMembers(team)}>Agentes</Button>
                        <Button
                          variant="secondary"
                          onClick={() => {
                            setEditing(team);
                            setForm({ name: team.name, color: team.color || "#22d3ee" });
                            setOpen(true);
                          }}
                        >
                          Editar
                        </Button>
                        <Button variant="ghost" onClick={() => toggleActive(team)}>
                          {team.active ? "Desativar" : "Ativar"}
                        </Button>
                      </div>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {loading ? <p className="px-5 py-6 text-sm text-muted">Carregando equipes...</p> : null}
        {!loading && !teams.length ? <p className="px-5 py-6 text-sm text-muted">Nenhuma equipe cadastrada.</p> : null}
      </Card>

      <Modal
        open={open}
        title={editing ? "Editar equipe" : "Nova equipe"}
        onClose={closeForm}
        footer={
          <>
            <Button type="button" variant="secondary" onClick={closeForm} disabled={saving}>Cancelar</Button>
            <Button type="submit" form="team-form" disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
          </>
        }
      >
        <form id="team-form" onSubmit={saveTeam} className="space-y-3">
          <Field label="Nome" required>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Vendas, Reservas, Pós-venda..." />
          </Field>
          <Field label="Cor">
            <Input type="color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} />
          </Field>
        </form>
      </Modal>

      <Modal
        open={membersOpen}
        title={selected ? `Agentes · ${selected.name}` : "Agentes"}
        onClose={() => !saving && setMembersOpen(false)}
        className="max-w-2xl"
        footer={
          <>
            <Button type="button" variant="secondary" onClick={() => setMembersOpen(false)} disabled={saving}>Cancelar</Button>
            <Button type="submit" form="members-form" disabled={saving}>{saving ? "Salvando..." : "Salvar agentes"}</Button>
          </>
        }
      >
        <form id="members-form" onSubmit={saveMembers} className="space-y-3">
          {memberRows.map((row, index) => (
            <div key={`${row.userId}-${index}`} className="grid gap-2 sm:grid-cols-[1fr_160px_110px_auto]">
              <Select
                value={row.userId}
                onChange={(e) => {
                  const next = [...memberRows];
                  next[index] = { ...next[index], userId: Number(e.target.value) };
                  setMemberRows(next);
                }}
              >
                {users.map((user) => (
                  <option key={user.id} value={user.id}>{user.name}</option>
                ))}
              </Select>
              <Select
                value={row.role}
                onChange={(e) => {
                  const next = [...memberRows];
                  next[index] = { ...next[index], role: e.target.value };
                  setMemberRows(next);
                }}
              >
                {Object.entries(INBOX_TEAM_MEMBER_ROLE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </Select>
              <Input
                type="number"
                min="0"
                value={row.conversationLimit}
                onChange={(e) => {
                  const next = [...memberRows];
                  next[index] = { ...next[index], conversationLimit: Number(e.target.value) };
                  setMemberRows(next);
                }}
                title="Limite de conversas (0 = sem limite)"
              />
              <Button
                type="button"
                variant="ghost"
                onClick={() => setMemberRows(memberRows.filter((_, i) => i !== index))}
              >
                Remover
              </Button>
            </div>
          ))}
          <Button type="button" variant="secondary" onClick={addMemberRow}>Adicionar agente</Button>
          {!users.length ? <p className="text-sm text-muted">Nenhum usuário ativo para vincular.</p> : null}
        </form>
      </Modal>
    </div>
  );
}
