"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api-client";
import { Button, Card, Field, Input, PageHeader, Select, Textarea } from "@/components/ui";
import { Modal } from "@/components/modal";
import { InboxConnectionBadge, InboxProviderBadge } from "@/components/badges";
import {
  defaultBusinessHours,
  GREETING_MODE_LABELS,
  GREETING_MODES,
  INBOX_CONNECTION_STATUSES,
  INBOX_PROVIDERS,
  INBOX_PROVIDER_LABELS,
  INBOX_TIMEZONES,
  UNANSWERED_MINUTE_OPTIONS,
  WEEKDAY_LABELS,
} from "@/lib/constants";
import { can, PERMISSIONS } from "@/lib/permissions";
import { formatPhone } from "@/lib/phone";
import { cn } from "@/lib/format";

const emptyAutomation = {
  businessHoursEnabled: false,
  timezone: "America/Sao_Paulo",
  businessHours: defaultBusinessHours(),
  afterHoursReplyEnabled: false,
  afterHoursMessage: "",
  greetingEnabled: false,
  greetingMode: GREETING_MODES.FIRST_CONTACT,
  greetingMessage: "",
  unansweredEnabled: false,
  unansweredMinutes: 5,
  unansweredMessage: "",
};

const empty = {
  name: "",
  provider: INBOX_PROVIDERS.DIALOG_360,
  defaultTeamId: "",
  phoneNumber: "",
  apiKey: "",
  externalId: "",
  ...emptyAutomation,
};

function automationFrom(channel) {
  return {
    businessHoursEnabled: Boolean(channel?.businessHoursEnabled),
    timezone: channel?.timezone || "America/Sao_Paulo",
    businessHours: channel?.businessHours?.length ? channel.businessHours : defaultBusinessHours(),
    afterHoursReplyEnabled: Boolean(channel?.afterHoursReplyEnabled),
    afterHoursMessage: channel?.afterHoursMessage || "",
    greetingEnabled: Boolean(channel?.greetingEnabled),
    greetingMode: channel?.greetingMode || GREETING_MODES.FIRST_CONTACT,
    greetingMessage: channel?.greetingMessage || "",
    unansweredEnabled: Boolean(channel?.unansweredEnabled),
    unansweredMinutes: Number(channel?.unansweredMinutes || 5),
    unansweredMessage: channel?.unansweredMessage || "",
  };
}

function automationSummary(channel) {
  const parts = [];
  if (channel.businessHoursEnabled) parts.push("Horário");
  if (channel.greetingEnabled) parts.push("Saudação");
  if (channel.unansweredEnabled) parts.push("Timeout");
  return parts.length ? parts.join(" · ") : "Manual";
}

export default function CanaisPage() {
  const [me, setMe] = useState(null);
  const [channels, setChannels] = useState([]);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState(null);
  const [qrChannel, setQrChannel] = useState(null);
  const [tab, setTab] = useState("conexao");

  const [webhookBase, setWebhookBase] = useState("");

  const canManage = me && can(me.role, PERMISSIONS.INBOX_CHANNEL_MANAGE);

  useEffect(() => {
    setWebhookBase(window.location.origin);
  }, []);

  async function load() {
    setLoading(true);
    try {
      const [{ user }, channelData, teamData] = await Promise.all([
        api("/api/auth/me"),
        api("/api/inbox/channels"),
        api("/api/inbox/teams?active=true"),
      ]);
      setMe(user);
      setChannels(channelData.items || []);
      setTeams(teamData.items || []);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (!qrOpen || !qrChannel?.id) return undefined;
    const timer = setInterval(async () => {
      try {
        const data = await api(`/api/inbox/channels/${qrChannel.id}?qr=1`);
        setQrChannel(data.channel);
        if (data.channel.connectionStatus === INBOX_CONNECTION_STATUSES.CONNECTED) {
          toast.success("WhatsApp não oficial conectado.");
          setQrOpen(false);
          void load();
        }
      } catch {
        // keep polling
      }
    }, 2500);
    return () => clearInterval(timer);
  }, [qrOpen, qrChannel?.id]);

  function closeForm() {
    if (saving) return;
    setOpen(false);
    setEditing(null);
    setForm(empty);
    setTab("conexao");
  }

  function openCreate() {
    setEditing(null);
    setForm({ ...empty, defaultTeamId: teams[0]?.id || "" });
    setTab("conexao");
    setOpen(true);
  }

  function openEdit(channel) {
    setEditing(channel);
    setForm({
      name: channel.name,
      provider: channel.provider,
      defaultTeamId: channel.defaultTeamId,
      phoneNumber: channel.phoneNumber || "",
      apiKey: "",
      externalId: channel.externalId || "",
      ...automationFrom(channel),
    });
    setTab("conexao");
    setOpen(true);
  }

  function setHour(weekday, patch) {
    setForm((current) => ({
      ...current,
      businessHours: current.businessHours.map((row) => (
        row.weekday === weekday ? { ...row, ...patch } : row
      )),
    }));
  }

  async function save(event) {
    event.preventDefault();
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        provider: form.provider,
        defaultTeamId: Number(form.defaultTeamId),
        phoneNumber: form.phoneNumber,
        externalId: form.externalId,
        businessHoursEnabled: form.businessHoursEnabled,
        timezone: form.timezone,
        businessHours: form.businessHours,
        afterHoursReplyEnabled: form.afterHoursReplyEnabled,
        afterHoursMessage: form.afterHoursMessage,
        greetingEnabled: form.greetingEnabled,
        greetingMode: form.greetingMode,
        greetingMessage: form.greetingMessage,
        unansweredEnabled: form.unansweredEnabled,
        unansweredMinutes: Number(form.unansweredMinutes),
        unansweredMessage: form.unansweredMessage,
      };
      if (form.apiKey) payload.apiKey = form.apiKey;
      if (editing) {
        await api(`/api/inbox/channels/${editing.id}`, { method: "PATCH", json: payload });
        toast.success("Canal atualizado.");
      } else {
        await api("/api/inbox/channels", { method: "POST", json: payload });
        toast.success("Canal cadastrado.");
      }
      closeForm();
      await load();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  }

  async function connect(channel) {
    try {
      const data = await api(`/api/inbox/channels/${channel.id}/qr`, { method: "POST" });
      setQrChannel(data.channel);
      setQrOpen(true);
    } catch (error) {
      toast.error(error.message);
    }
  }

  async function disconnect(channel) {
    try {
      await api(`/api/inbox/channels/${channel.id}/qr`, { method: "DELETE" });
      toast.success("Canal desconectado.");
      await load();
    } catch (error) {
      toast.error(error.message);
    }
  }

  async function toggleActive(channel) {
    try {
      await api(`/api/inbox/channels/${channel.id}`, { method: "PATCH", json: { active: !channel.active } });
      toast.success(channel.active ? "Canal desativado." : "Canal ativado.");
      await load();
    } catch (error) {
      toast.error(error.message);
    }
  }

  function copy(text) {
    navigator.clipboard.writeText(text).then(() => toast.success("URL copiada.")).catch(() => toast.error("Não foi possível copiar."));
  }

  return (
    <div className="w-full">
      <PageHeader
        title="Canais"
        subtitle="Conexões de WhatsApp, horário de atendimento e respostas automáticas."
        actions={canManage ? <Button onClick={openCreate}>Novo canal</Button> : null}
      />

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-5 py-3 font-semibold">Canal</th>
                <th className="px-5 py-3 font-semibold">Provedor</th>
                <th className="px-5 py-3 font-semibold">Número</th>
                <th className="px-5 py-3 font-semibold">Equipe</th>
                <th className="px-5 py-3 font-semibold">Atendimento</th>
                <th className="px-5 py-3 font-semibold">Conexão</th>
                <th className="px-5 py-3 font-semibold" />
              </tr>
            </thead>
            <tbody>
              {channels.map((channel) => (
                <tr key={channel.id} className="border-t border-border">
                  <td className="px-5 py-4 font-medium">{channel.name}</td>
                  <td className="px-5 py-4"><InboxProviderBadge provider={channel.provider} /></td>
                  <td className="px-5 py-4 text-muted">{channel.phoneNumber ? formatPhone(channel.phoneNumber) : "—"}</td>
                  <td className="px-5 py-4 text-muted">{channel.defaultTeam?.name || "—"}</td>
                  <td className="px-5 py-4 text-muted">{automationSummary(channel)}</td>
                  <td className="px-5 py-4"><InboxConnectionBadge status={channel.connectionStatus} /></td>
                  <td className="px-5 py-4 text-right">
                    {canManage ? (
                      <div className="flex flex-wrap justify-end gap-2">
                        {channel.provider === INBOX_PROVIDERS.UNOFFICIAL ? (
                          channel.connectionStatus === INBOX_CONNECTION_STATUSES.CONNECTED ? (
                            <Button variant="secondary" onClick={() => disconnect(channel)}>Desconectar</Button>
                          ) : (
                            <Button variant="secondary" onClick={() => connect(channel)}>Conectar QR</Button>
                          )
                        ) : channel.webhookPath ? (
                          <Button variant="secondary" onClick={() => copy(`${webhookBase}${channel.webhookPath}`)}>Webhook</Button>
                        ) : null}
                        <Button variant="secondary" onClick={() => openEdit(channel)}>Editar</Button>
                        <Button variant="ghost" onClick={() => toggleActive(channel)}>
                          {channel.active ? "Desativar" : "Ativar"}
                        </Button>
                      </div>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {loading ? <p className="px-5 py-6 text-sm text-muted">Carregando canais...</p> : null}
        {!loading && !channels.length ? <p className="px-5 py-6 text-sm text-muted">Nenhum canal cadastrado. Crie uma equipe antes do primeiro canal.</p> : null}
      </Card>

      <Modal
        open={open}
        title={editing ? "Editar canal" : "Novo canal"}
        onClose={closeForm}
        className="max-w-3xl"
        footer={
          <>
            <Button type="button" variant="secondary" onClick={closeForm} disabled={saving}>Cancelar</Button>
            <Button type="submit" form="channel-form" disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
          </>
        }
      >
        <div className="mb-4 flex gap-1 rounded-xl bg-surface-2 p-1">
          {[
            { id: "conexao", label: "Conexão" },
            { id: "atendimento", label: "Atendimento" },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              className={cn(
                "flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition",
                tab === item.id ? "bg-bg text-text shadow-sm" : "text-muted hover:text-text",
              )}
              onClick={() => setTab(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>

        <form id="channel-form" onSubmit={save} className="space-y-3">
          {tab === "conexao" ? (
            <>
              <Field label="Nome" required>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="WhatsApp Vendas" />
              </Field>
              <Field label="Provedor" required>
                <Select
                  value={form.provider}
                  disabled={Boolean(editing)}
                  onChange={(e) => setForm({ ...form, provider: e.target.value })}
                >
                  {Object.entries(INBOX_PROVIDER_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Equipe padrão" required>
                <Select value={form.defaultTeamId} onChange={(e) => setForm({ ...form, defaultTeamId: e.target.value })}>
                  <option value="">Selecione</option>
                  {teams.map((team) => (
                    <option key={team.id} value={team.id}>{team.name}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Número do WhatsApp">
                <Input value={form.phoneNumber} onChange={(e) => setForm({ ...form, phoneNumber: e.target.value })} placeholder="5511999999999" />
              </Field>
              {form.provider === INBOX_PROVIDERS.DIALOG_360 ? (
                <>
                  <Field label="API key 360dialog" hint={editing ? "Deixe em branco para manter a chave atual." : "Header D360-API-KEY"}>
                    <Input value={form.apiKey} onChange={(e) => setForm({ ...form, apiKey: e.target.value })} placeholder="Cole a API key" />
                  </Field>
                  <Field label="Phone number ID" hint="Opcional. Preenchido automaticamente no primeiro webhook.">
                    <Input value={form.externalId} onChange={(e) => setForm({ ...form, externalId: e.target.value })} />
                  </Field>
                </>
              ) : (
                <p className="text-sm text-muted">
                  Depois de salvar, use Conectar QR com o worker `npm run whatsapp:worker` em execução neste servidor.
                </p>
              )}
            </>
          ) : (
            <>
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={form.businessHoursEnabled}
                  onChange={(e) => setForm({ ...form, businessHoursEnabled: e.target.checked })}
                />
                <span>
                  <span className="font-medium">Usar horário de atendimento</span>
                  <span className="mt-0.5 block text-xs text-muted">Fora desse horário a conversa continua na fila, com o aviso abaixo se estiver ligado.</span>
                </span>
              </label>

              <Field label="Fuso horário">
                <Select value={form.timezone} onChange={(e) => setForm({ ...form, timezone: e.target.value })} disabled={!form.businessHoursEnabled}>
                  {INBOX_TIMEZONES.map((item) => (
                    <option key={item.value} value={item.value}>{item.label}</option>
                  ))}
                </Select>
              </Field>

              <div className="overflow-hidden rounded-xl border border-border">
                <table className="w-full text-sm">
                  <thead className="bg-surface-2 text-xs uppercase tracking-wide text-muted">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold">Dia</th>
                      <th className="px-3 py-2 text-left font-semibold">Início</th>
                      <th className="px-3 py-2 text-left font-semibold">Fim</th>
                    </tr>
                  </thead>
                  <tbody>
                    {form.businessHours.map((row) => (
                      <tr key={row.weekday} className="border-t border-border">
                        <td className="px-3 py-2">
                          <label className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={row.enabled}
                              disabled={!form.businessHoursEnabled}
                              onChange={(e) => setHour(row.weekday, { enabled: e.target.checked })}
                            />
                            {WEEKDAY_LABELS[row.weekday]}
                          </label>
                        </td>
                        <td className="px-3 py-2">
                          <Input
                            type="time"
                            value={row.start}
                            disabled={!form.businessHoursEnabled || !row.enabled}
                            onChange={(e) => setHour(row.weekday, { start: e.target.value })}
                          />
                        </td>
                        <td className="px-3 py-2">
                          <Input
                            type="time"
                            value={row.end}
                            disabled={!form.businessHoursEnabled || !row.enabled}
                            onChange={(e) => setHour(row.weekday, { end: e.target.value })}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={form.afterHoursReplyEnabled}
                  disabled={!form.businessHoursEnabled}
                  onChange={(e) => setForm({ ...form, afterHoursReplyEnabled: e.target.checked })}
                />
                <span>
                  <span className="font-medium">Enviar aviso fora do horário</span>
                  <span className="mt-0.5 block text-xs text-muted">Uma vez por espera, até um agente responder ou a conversa ser encerrada.</span>
                </span>
              </label>
              <Field label="Texto fora do horário">
                <Textarea
                  value={form.afterHoursMessage}
                  disabled={!form.businessHoursEnabled || !form.afterHoursReplyEnabled}
                  onChange={(e) => setForm({ ...form, afterHoursMessage: e.target.value })}
                  placeholder="Nosso atendimento retorna no próximo horário comercial."
                />
              </Field>

              <div className="border-t border-border pt-3">
                <label className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={form.greetingEnabled}
                    onChange={(e) => setForm({ ...form, greetingEnabled: e.target.checked })}
                  />
                  <span>
                    <span className="font-medium">Enviar saudação</span>
                    <span className="mt-0.5 block text-xs text-muted">Só no horário de atendimento, se o horário estiver ligado. Fora do expediente vale o aviso acima.</span>
                  </span>
                </label>
              </div>
              <Field label="Quando enviar">
                <Select
                  value={form.greetingMode}
                  disabled={!form.greetingEnabled}
                  onChange={(e) => setForm({ ...form, greetingMode: e.target.value })}
                >
                  {Object.entries(GREETING_MODE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Texto da saudação">
                <Textarea
                  value={form.greetingMessage}
                  disabled={!form.greetingEnabled}
                  onChange={(e) => setForm({ ...form, greetingMessage: e.target.value })}
                  placeholder="Olá! Seu atendimento já está na fila."
                />
              </Field>

              <div className="border-t border-border pt-3">
                <label className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={form.unansweredEnabled}
                    onChange={(e) => setForm({ ...form, unansweredEnabled: e.target.checked })}
                  />
                  <span>
                    <span className="font-medium">Avisar se nenhum agente responder</span>
                    <span className="mt-0.5 block text-xs text-muted">Só para conversas sem agente, no horário de atendimento. Não dispara de novo na mesma espera.</span>
                  </span>
                </label>
              </div>
              <Field label="Marcar como não respondida em">
                <Select
                  value={form.unansweredMinutes}
                  disabled={!form.unansweredEnabled}
                  onChange={(e) => setForm({ ...form, unansweredMinutes: Number(e.target.value) })}
                >
                  {UNANSWERED_MINUTE_OPTIONS.map((minutes) => (
                    <option key={minutes} value={minutes}>{minutes} minutos</option>
                  ))}
                </Select>
              </Field>
              <Field label="Texto quando ninguém responder">
                <Textarea
                  value={form.unansweredMessage}
                  disabled={!form.unansweredEnabled}
                  onChange={(e) => setForm({ ...form, unansweredMessage: e.target.value })}
                  placeholder="No momento, todos os nossos agentes estão ocupados. Você será atendido em breve!"
                />
              </Field>
            </>
          )}
        </form>
      </Modal>

      <Modal
        open={qrOpen}
        title="Conectar WhatsApp não oficial"
        onClose={() => setQrOpen(false)}
        className="max-w-md"
        footer={<Button variant="secondary" onClick={() => setQrOpen(false)}>Fechar</Button>}
      >
        {qrChannel?.qrPayload ? (
          <div className="space-y-3 text-center">
            <img src={qrChannel.qrPayload} alt="QR Code WhatsApp" className="mx-auto w-64 rounded-xl bg-white p-3" />
            <p className="text-sm text-muted">Abra o WhatsApp no celular, em Aparelhos conectados, e leia o QR Code.</p>
          </div>
        ) : (
          <p className="text-sm text-muted">
            {qrChannel?.connectionError || "Aguardando o worker gerar o QR Code. Confirme se `npm run whatsapp:worker` está rodando."}
          </p>
        )}
      </Modal>
    </div>
  );
}
