"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Paperclip, X } from "lucide-react";
import { toast } from "sonner";
import { api, uploadWithProgress } from "@/lib/api-client";
import { Button, Field, Input, Select, Textarea } from "@/components/ui";
import { Modal } from "@/components/modal";
import { CustomerPicker } from "@/components/customer-picker";
import { ConversationStatusBadge, InboxProviderBadge } from "@/components/badges";
import {
  CONVERSATION_EVENT_LABELS,
  CONVERSATION_EVENT_TYPES,
  CONVERSATION_STATUSES,
  CONVERSATION_STATUS_LABELS,
  INBOX_CONNECTION_STATUSES,
  INBOX_PROVIDERS,
  MESSAGE_DIRECTIONS,
} from "@/lib/constants";
import { can, PERMISSIONS } from "@/lib/permissions";
import { cn, formatDateTime, formatDuration, formatRelativeTime } from "@/lib/format";
import { formatPhone } from "@/lib/phone";
import { listQuery } from "@/lib/pagination";

const TABS = [
  { id: "open", label: "Abertas" },
  { id: "waiting", label: "Aguardando agente" },
  { id: "replied", label: "Agente respondeu" },
  { id: "closed", label: "Encerradas" },
];

const SCOPES = [
  { id: "team", label: "Da equipe" },
  { id: "mine", label: "Minhas" },
  { id: "unassigned", label: "Não atribuídas" },
];

const EMPTY_START = { channelId: "", customer: null, phone: "", contactName: "", body: "" };
const MEDIA_ACCEPT = "image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime,.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip";

function mediaKind(message) {
  const mime = String(message.mediaType || "").toLowerCase();
  const name = String(message.fileName || message.mediaUrl || "");
  if (mime.startsWith("image/") || mime === "image" || /\.(jpe?g|png|webp|gif)$/i.test(name)) return "image";
  if (mime.startsWith("video/") || mime === "video" || /\.(mp4|mov|3gp)$/i.test(name)) return "video";
  if (message.mediaUrl || message.fileName || mime.startsWith("application/") || mime === "document") return "document";
  return null;
}

function conversationTimeline(conversation) {
  const messages = (conversation?.messages || []).map((item) => ({ kind: "message", at: item.sentAt, item }));
  const events = (conversation?.events || [])
    .filter((item) => item.type !== CONVERSATION_EVENT_TYPES.NOTE)
    .map((item) => ({ kind: "event", at: item.createdAt, item }));
  return [...messages, ...events].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
}

export default function InboxPage() {
  const router = useRouter();
  const [me, setMe] = useState(null);
  const [teams, setTeams] = useState([]);
  const [items, setItems] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [conversation, setConversation] = useState(null);
  const [tab, setTab] = useState("open");
  const [scope, setScope] = useState("team");
  const [teamId, setTeamId] = useState("");
  const [q, setQ] = useState("");
  const [draft, setDraft] = useState("");
  const [internal, setInternal] = useState(false);
  const [file, setFile] = useState(null);
  const [sending, setSending] = useState(false);
  const [loadingList, setLoadingList] = useState(true);
  const [transferOpen, setTransferOpen] = useState(false);
  const [transfer, setTransfer] = useState({ teamId: "", agentId: "" });
  const [startOpen, setStartOpen] = useState(false);
  const [starting, setStarting] = useState(false);
  const [channels, setChannels] = useState([]);
  const [start, setStart] = useState(EMPTY_START);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkCustomer, setLinkCustomer] = useState(null);
  const [linking, setLinking] = useState(false);
  const fileRef = useRef(null);
  const messagesRef = useRef(null);
  const selectedIdRef = useRef(null);

  selectedIdRef.current = selectedId;

  const canReply = me && can(me.role, PERMISSIONS.INBOX_REPLY);
  const canAssign = me && can(me.role, PERMISSIONS.INBOX_ASSIGN);
  const canCreateSale = me && can(me.role, PERMISSIONS.SALE_CREATE);

  const loadList = useCallback(async () => {
    try {
      const data = await api(`/api/inbox/conversations?${listQuery({ tab, scope, teamId, q }, 1, 80)}`);
      setItems(data.items || []);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoadingList(false);
    }
  }, [tab, scope, teamId, q]);

  const loadConversation = useCallback(async (id) => {
    if (!id) return;
    try {
      const data = await api(`/api/inbox/conversations/${id}`);
      setConversation(data.conversation);
    } catch (error) {
      toast.error(error.message);
    }
  }, []);

  useEffect(() => {
    api("/api/auth/me").then((auth) => setMe(auth.user)).catch((error) => toast.error(error.message));
    api("/api/inbox/teams?active=true").then((data) => setTeams(data.items || [])).catch(() => {});
    const conversationId = Number(new URLSearchParams(window.location.search).get("conversationId") || 0);
    if (conversationId) setSelectedId(conversationId);
  }, []);

  useEffect(() => {
    setLoadingList(true);
    void loadList();
  }, [loadList]);

  useEffect(() => {
    const timer = setInterval(() => {
      void loadList();
      if (selectedIdRef.current) void loadConversation(selectedIdRef.current);
    }, 6000);
    return () => clearInterval(timer);
  }, [loadList, loadConversation]);

  useEffect(() => {
    if (selectedId) void loadConversation(selectedId);
    else setConversation(null);
  }, [selectedId, loadConversation]);

  const selected = conversation;
  const timeline = useMemo(() => conversationTimeline(selected), [selected]);

  useEffect(() => {
    if (messagesRef.current) {
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
    }
  }, [conversation?.id, timeline.length]);
  const isMine = selected && me && selected.agentId === me.id;
  const isClosed = selected?.status === CONVERSATION_STATUSES.CLOSED;
  const transferTeam = useMemo(
    () => teams.find((team) => Number(team.id) === Number(transfer.teamId)),
    [teams, transfer.teamId],
  );

  async function runAction(path, json, success) {
    if (!selected) return;
    try {
      const data = await api(path, { method: "POST", json });
      setConversation(data.conversation);
      toast.success(success || data.message);
      void loadList();
    } catch (error) {
      toast.error(error.message);
    }
  }

  async function send(event) {
    event.preventDefault();
    if (!selected || (!draft.trim() && !file)) return;
    setSending(true);
    try {
      let data;
      if (file && !internal) {
        const form = new FormData();
        form.append("body", draft);
        form.append("internal", "false");
        form.append("file", file);
        data = await uploadWithProgress(`/api/inbox/conversations/${selected.id}/messages`, form);
      } else {
        data = await api(`/api/inbox/conversations/${selected.id}/messages`, {
          method: "POST",
          json: { body: draft, internal },
        });
      }
      setConversation(data.conversation);
      setDraft("");
      setInternal(false);
      setFile(null);
      void loadList();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSending(false);
    }
  }

  async function submitTransfer(event) {
    event.preventDefault();
    await runAction(
      `/api/inbox/conversations/${selected.id}/transfer`,
      { teamId: Number(transfer.teamId), agentId: transfer.agentId ? Number(transfer.agentId) : null },
      "Conversa transferida.",
    );
    setTransferOpen(false);
  }

  async function openStart() {
    setStart(EMPTY_START);
    setStartOpen(true);
    try {
      const data = await api("/api/inbox/channels?outbound=1");
      const items = data.items || [];
      setChannels(items);
      if (items.length === 1) setStart((current) => ({ ...current, channelId: String(items[0].id) }));
    } catch (error) {
      toast.error(error.message);
    }
  }

  async function submitStart(event) {
    event.preventDefault();
    setStarting(true);
    try {
      const data = await api("/api/inbox/conversations", {
        method: "POST",
        json: {
          channelId: Number(start.channelId),
          customerId: start.customer?.id || null,
          phone: start.phone,
          contactName: start.contactName,
          body: start.body,
        },
      });
      toast.success(data.message);
      setStartOpen(false);
      setStart(EMPTY_START);
      setTab("open");
      setScope("mine");
      setSelectedId(data.conversation.id);
      setConversation(data.conversation);
      void loadList();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setStarting(false);
    }
  }

  async function submitLinkCustomer(event) {
    event.preventDefault();
    if (!selected || !linkCustomer) return;
    setLinking(true);
    try {
      const data = await api(`/api/inbox/conversations/${selected.id}`, {
        method: "PATCH",
        json: { customerId: linkCustomer.id },
      });
      setConversation(data.conversation);
      toast.success(data.message);
      setLinkOpen(false);
      setLinkCustomer(null);
      void loadList();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLinking(false);
    }
  }

  return (
    <div className="flex h-[calc(100vh-7.5rem)] min-h-[560px] flex-col gap-4 lg:h-[calc(100vh-6rem)]">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">Eletro-Stock</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Conversas</h1>
          <p className="mt-1 text-sm text-muted">Filas do Contact Center, organizadas por equipe e status.</p>
        </div>
        {canReply ? <Button onClick={() => void openStart()}>Nova conversa</Button> : null}
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-border bg-surface lg:flex-row">
        <aside className="flex w-full shrink-0 flex-col border-b border-border lg:w-[360px] lg:border-b-0 lg:border-r">
          <div className="space-y-3 border-b border-border p-3">
            <div className="flex flex-wrap gap-1">
              {TABS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTab(item.id)}
                  className={cn(
                    "rounded-lg px-2.5 py-1 text-xs font-semibold",
                    tab === item.id ? "bg-accent/15 text-accent" : "text-muted hover:bg-surface-2",
                  )}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Select value={scope} onChange={(e) => setScope(e.target.value)}>
                {SCOPES.map((item) => (
                  <option key={item.id} value={item.id}>{item.label}</option>
                ))}
              </Select>
              <Select value={teamId} onChange={(e) => setTeamId(e.target.value)}>
                <option value="">Todas as equipes</option>
                {teams.map((team) => (
                  <option key={team.id} value={team.id}>{team.name}</option>
                ))}
              </Select>
            </div>
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar nome, telefone ou mensagem" />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {loadingList && !items.length ? <p className="p-4 text-sm text-muted">Carregando conversas...</p> : null}
            {!loadingList && !items.length ? <p className="p-4 text-sm text-muted">Nenhuma conversa nesta fila.</p> : null}
            {items.map((item) => {
              const active = item.id === selectedId;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedId(item.id)}
                  className={cn(
                    "w-full border-b border-border px-4 py-3 text-left transition",
                    active ? "bg-accent/10" : "hover:bg-surface-2/80",
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="truncate font-medium">{item.displayName}</p>
                    <span className="shrink-0 text-[11px] text-muted">{formatRelativeTime(item.lastMessageAt || item.createdAt)}</span>
                  </div>
                  <p className="mt-1 truncate text-xs text-muted">{item.lastMessagePreview || "Sem mensagens"}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <ConversationStatusBadge status={item.status} />
                    {item.unreadCount > 0 ? (
                      <span className="rounded-full bg-accent px-1.5 text-[10px] font-bold text-slate-950">{item.unreadCount}</span>
                    ) : null}
                    <span className="text-[11px] text-muted">{item.team?.name}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        <section className="flex min-h-0 min-w-0 flex-1 flex-col">
          {!selected ? (
            <div className="flex flex-1 items-center justify-center p-8 text-sm text-muted">
              Selecione uma conversa à esquerda.
            </div>
          ) : (
            <>
              <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border p-4">
                <div>
                  <p className="text-lg font-semibold">{selected.displayName}</p>
                  <p className="text-sm text-muted">{formatPhone(selected.phone)}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <ConversationStatusBadge status={selected.status} />
                    <InboxProviderBadge provider={selected.channel?.provider} />
                    <span className="text-xs text-muted">{selected.team?.name}</span>
                    {selected.agent?.name ? <span className="text-xs text-muted">Agente: {selected.agent.name}</span> : <span className="text-xs text-amber-300">Sem agente</span>}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {canCreateSale && selected.customer ? (
                    <Button
                      variant="secondary"
                      onClick={() => router.push(`/vendas/novo?customerId=${selected.customer.id}&conversationId=${selected.id}`)}
                    >
                      Abrir venda
                    </Button>
                  ) : null}
                  {canReply && !selected.customer ? (
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setLinkCustomer(null);
                        setLinkOpen(true);
                      }}
                    >
                      Vincular cliente
                    </Button>
                  ) : null}
                  {canReply && !isClosed && !isMine ? (
                    <Button onClick={() => runAction(`/api/inbox/conversations/${selected.id}/accept`, {}, "Conversa aceita.")}>Aceitar</Button>
                  ) : null}
                  {canAssign && !isClosed ? (
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setTransfer({ teamId: selected.teamId, agentId: selected.agentId || "" });
                        setTransferOpen(true);
                      }}
                    >
                      Transferir
                    </Button>
                  ) : null}
                  {canReply && !isClosed ? (
                    <Button variant="secondary" onClick={() => runAction(`/api/inbox/conversations/${selected.id}/close`, {}, "Conversa encerrada.")}>Encerrar</Button>
                  ) : null}
                  {canReply && isClosed ? (
                    <Button onClick={() => runAction(`/api/inbox/conversations/${selected.id}/reopen`, {}, "Conversa reaberta.")}>Reabrir</Button>
                  ) : null}
                </div>
              </header>

              <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1fr)_280px]">
                <div className="flex min-h-0 flex-col border-b border-border lg:border-b-0 lg:border-r">
                  <div ref={messagesRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
                    {timeline.map((entry) => {
                      if (entry.kind === "event") {
                        return (
                          <div key={`event-${entry.item.id}`} className="flex justify-center">
                            <p className="max-w-[90%] rounded-full bg-surface-2 px-3 py-1 text-center text-[11px] text-muted">
                              {entry.item.message || CONVERSATION_EVENT_LABELS[entry.item.type] || "Atualização da conversa"}
                              <span className="ml-1 opacity-70">· {formatDateTime(entry.item.createdAt)}</span>
                            </p>
                          </div>
                        );
                      }
                      const message = entry.item;
                      const incoming = message.direction === MESSAGE_DIRECTIONS.IN;
                      const note = message.direction === MESSAGE_DIRECTIONS.INTERNAL;
                      const kind = mediaKind(message);
                      return (
                        <div key={`msg-${message.id}`} className={cn("flex", incoming ? "justify-start" : "justify-end")}>
                          <div
                            className={cn(
                              "max-w-[85%] rounded-2xl px-3.5 py-2 text-sm",
                              note
                                ? "bg-amber-500/10 text-amber-800 ring-1 ring-amber-500/20 dark:text-amber-100"
                                : incoming
                                  ? "bg-surface-2"
                                  : "bg-accent/15 text-text",
                            )}
                          >
                            {note ? <p className="mb-1 text-[10px] uppercase tracking-wide text-amber-300">Nota interna</p> : null}
                            {!note && !incoming && !message.user ? (
                              <p className="mb-1 text-[10px] uppercase tracking-wide text-muted">Automático</p>
                            ) : null}
                            {message.mediaUrl && kind === "image" ? (
                              <a href={message.mediaUrl} target="_blank" rel="noreferrer" className="mb-2 block">
                                <img src={message.mediaUrl} alt={message.fileName || "Imagem"} className="max-h-56 rounded-xl object-contain" />
                              </a>
                            ) : null}
                            {message.mediaUrl && kind === "video" ? (
                              <video src={message.mediaUrl} controls className="mb-2 max-h-56 w-full rounded-xl" />
                            ) : null}
                            {message.mediaUrl && kind === "document" ? (
                              <a href={message.mediaUrl} target="_blank" rel="noreferrer" className="mb-2 inline-flex items-center gap-2 rounded-xl bg-bg/60 px-3 py-2 text-xs font-medium hover:underline">
                                {message.fileName || "Documento"}
                              </a>
                            ) : null}
                            {!message.mediaUrl && message.mediaType && !message.body ? (
                              <p className="mb-1 text-xs text-muted">{message.fileName || message.mediaType}</p>
                            ) : null}
                            {message.body ? <p className="whitespace-pre-wrap">{message.body}</p> : null}
                            <p className="mt-1 text-[11px] text-muted">
                              {message.user?.name ? `${message.user.name} · ` : ""}
                              {formatDateTime(message.sentAt)}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {canReply ? (
                    <form onSubmit={send} className="border-t border-border p-3">
                      {file ? (
                        <div className="mb-2 flex items-center justify-between gap-2 rounded-xl border border-border bg-surface-2 px-3 py-2 text-xs">
                          <span className="truncate">{file.name}</span>
                          <button type="button" onClick={() => setFile(null)} className="rounded-full p-1 text-muted hover:bg-bg" aria-label="Remover anexo">
                            <X size={14} />
                          </button>
                        </div>
                      ) : null}
                      <Textarea
                        className="min-h-20"
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        placeholder={isClosed ? "Reabra a conversa para responder." : internal ? "Nota visível só para o time..." : "Escreva a resposta..."}
                        disabled={sending || (isClosed && !internal)}
                      />
                      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-3">
                          <label className="flex items-center gap-2 text-xs text-muted">
                            <input type="checkbox" checked={internal} onChange={(e) => { setInternal(e.target.checked); if (e.target.checked) setFile(null); }} />
                            Nota interna
                          </label>
                          <input
                            ref={fileRef}
                            type="file"
                            accept={MEDIA_ACCEPT}
                            className="hidden"
                            onChange={(event) => {
                              const next = event.target.files?.[0] || null;
                              setFile(next);
                              event.target.value = "";
                            }}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            className="px-2 py-1.5"
                            disabled={sending || internal || (isClosed && !internal)}
                            onClick={() => fileRef.current?.click()}
                          >
                            <Paperclip size={16} />
                            Anexar
                          </Button>
                        </div>
                        <Button type="submit" disabled={sending || (isClosed && !internal) || (!draft.trim() && !file) || (internal && !draft.trim())}>
                          {sending ? "Enviando..." : internal ? "Registrar nota" : "Enviar"}
                        </Button>
                      </div>
                    </form>
                  ) : null}
                </div>

                <aside className="overflow-y-auto p-4 text-sm">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted">Detalhes</p>
                  <dl className="mt-3 space-y-3">
                    <Info label="Status" value={CONVERSATION_STATUS_LABELS[selected.status]} />
                    <Info label="Criada em" value={formatDateTime(selected.createdAt)} />
                    <Info label="Última mensagem" value={formatDateTime(selected.lastMessageAt)} />
                    <Info label="Aceita em" value={selected.acceptedAt ? `${formatDateTime(selected.acceptedAt)}${selected.acceptedBy?.name ? ` · ${selected.acceptedBy.name}` : ""}` : "Ainda não aceita"} />
                    <Info label="Primeira resposta" value={formatDateTime(selected.firstResponseAt)} />
                    <Info
                      label="Espera atual"
                      value={selected.status === CONVERSATION_STATUSES.WAITING_AGENT ? formatDuration(selected.waitingSince) : "—"}
                    />
                    <Info label="Encerrada em" value={selected.closedAt ? `${formatDateTime(selected.closedAt)}${selected.closedBy?.name ? ` · ${selected.closedBy.name}` : ""}` : "—"} />
                    <Info label="Canal" value={selected.channel?.name} />
                    <Info label="Equipe" value={selected.team?.name} />
                    <Info
                      label="Cliente"
                      value={
                        selected.customer ? (
                          <Link href={`/clientes/${selected.customer.id}`} className="text-accent hover:underline">
                            {selected.customer.name}
                          </Link>
                        ) : "Não vinculado ao cadastro"
                      }
                    />
                  </dl>
                  {selected.saleOrders?.length ? (
                    <div className="mt-5">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted">Vendas</p>
                      <ul className="mt-2 space-y-2">
                        {selected.saleOrders.map((order) => (
                          <li key={order.id}>
                            <Link href={`/vendas/${order.id}`} className="font-medium text-accent hover:underline">
                              {order.number}
                            </Link>
                            <p className="text-[11px] text-muted">
                              {order.seller?.name || "Sem vendedor"}
                            </p>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </aside>
              </div>
            </>
          )}
        </section>
      </div>

      <Modal
        open={transferOpen}
        title="Transferir conversa"
        onClose={() => setTransferOpen(false)}
        footer={
          <>
            <Button type="button" variant="secondary" onClick={() => setTransferOpen(false)}>Cancelar</Button>
            <Button type="submit" form="transfer-form">Transferir</Button>
          </>
        }
      >
        <form id="transfer-form" onSubmit={submitTransfer} className="space-y-3">
          <Field label="Equipe">
            <Select value={transfer.teamId} onChange={(e) => setTransfer({ teamId: e.target.value, agentId: "" })}>
              {teams.map((team) => (
                <option key={team.id} value={team.id}>{team.name}</option>
              ))}
            </Select>
          </Field>
          <Field label="Agente" hint="Vazio envia para a fila da equipe.">
            <Select value={transfer.agentId} onChange={(e) => setTransfer({ ...transfer, agentId: e.target.value })}>
              <option value="">Fila da equipe</option>
              {(transferTeam?.members || []).map((member) => (
                <option key={member.userId} value={member.userId}>{member.user?.name}</option>
              ))}
            </Select>
          </Field>
        </form>
      </Modal>

      <Modal
        open={startOpen}
        title="Nova conversa"
        className="max-w-xl"
        onClose={() => {
          if (!starting) setStartOpen(false);
        }}
        footer={
          <>
            <Button type="button" variant="secondary" onClick={() => setStartOpen(false)} disabled={starting}>Cancelar</Button>
            <Button type="submit" form="start-form" disabled={starting || !start.channelId || !start.phone.trim() || !start.body.trim()}>
              {starting ? "Enviando..." : "Enviar mensagem"}
            </Button>
          </>
        }
      >
        <form id="start-form" onSubmit={submitStart} className="space-y-3">
          <Field label="Canal" required>
            <Select value={start.channelId} onChange={(e) => setStart({ ...start, channelId: e.target.value })}>
              <option value="">Selecione o canal</option>
              {channels.map((channel) => {
                const ready = channel.provider !== INBOX_PROVIDERS.UNOFFICIAL || channel.connectionStatus === INBOX_CONNECTION_STATUSES.CONNECTED;
                return (
                  <option key={channel.id} value={channel.id} disabled={!ready}>
                    {channel.name}{ready ? "" : " (desconectado)"}
                  </option>
                );
              })}
            </Select>
          </Field>
          <CustomerPicker
            value={start.customer}
            onChange={(customer) => setStart({
              ...start,
              customer,
              phone: customer?.phone || "",
              contactName: customer?.name || start.contactName,
            })}
          />
          <Field label="Telefone" required hint="Com DDD. Se o cliente já estiver cadastrado, o telefone é preenchido.">
            <Input
              value={start.phone}
              onChange={(e) => setStart({ ...start, phone: e.target.value })}
              placeholder="(21) 99999-0000"
            />
          </Field>
          <Field label="Nome do contato">
            <Input
              value={start.contactName}
              onChange={(e) => setStart({ ...start, contactName: e.target.value })}
              placeholder="Opcional"
            />
          </Field>
          <Field label="Mensagem" required>
            <Textarea
              className="min-h-24"
              value={start.body}
              onChange={(e) => setStart({ ...start, body: e.target.value })}
              placeholder="Escreva a primeira mensagem..."
            />
          </Field>
          {channels.find((channel) => String(channel.id) === String(start.channelId))?.provider === INBOX_PROVIDERS.DIALOG_360 ? (
            <p className="text-xs text-muted">No WhatsApp oficial, texto livre só chega se o cliente já falou nas últimas 24 horas.</p>
          ) : null}
          {!channels.length ? (
            <p className="text-sm text-muted">Nenhum canal disponível. Cadastre e conecte um canal em Canais.</p>
          ) : null}
        </form>
      </Modal>

      <Modal
        open={linkOpen}
        title="Vincular cliente"
        onClose={() => {
          if (!linking) setLinkOpen(false);
        }}
        footer={
          <>
            <Button type="button" variant="secondary" onClick={() => setLinkOpen(false)} disabled={linking}>Cancelar</Button>
            <Button type="submit" form="link-customer-form" disabled={linking || !linkCustomer}>
              {linking ? "Vinculando..." : "Vincular"}
            </Button>
          </>
        }
      >
        <form id="link-customer-form" onSubmit={submitLinkCustomer} className="space-y-3">
          <p className="text-sm text-muted">Associe esta conversa a um cliente do cadastro para abrir uma venda comercial.</p>
          <CustomerPicker value={linkCustomer} onChange={setLinkCustomer} />
        </form>
      </Modal>
    </div>
  );
}

function Info({ label, value }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wide text-muted">{label}</dt>
      <dd className="mt-0.5">{value || "—"}</dd>
    </div>
  );
}
