"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { api } from "@/lib/api-client";
import { Button, Card, Field, Input, PageHeader, Select } from "@/components/ui";
import { LeadStageBadge } from "@/components/badges";
import { WaitlistDialog } from "@/components/waitlist-dialog";
import { LEAD_BOARD_STAGES, LEAD_STAGE_LABELS, LEAD_STAGES } from "@/lib/constants";
import { cn, formatRelativeTime } from "@/lib/format";
import { formatPhone } from "@/lib/phone";
import { can, PERMISSIONS } from "@/lib/permissions";

const COLUMN_TONES = {
  NOVO: "border-sky-500/40",
  EM_QUALIFICACAO: "border-cyan-500/40",
  INTERESSADO: "border-violet-500/40",
  LISTA_ESPERA: "border-fuchsia-500/40",
  POS_VENDAS: "border-teal-500/40",
  SEM_RETORNO: "border-amber-500/40",
  DESCARTADO: "border-slate-500/40",
};

function LeadCard({ item, draggable, onOpen, onDragStart, onDragEnd }) {
  return (
    <button
      type="button"
      draggable={draggable}
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", String(item.id));
        onDragStart(item);
      }}
      onDragEnd={onDragEnd}
      onClick={() => onOpen(item)}
      className="w-full rounded-xl border border-border bg-surface p-3 text-left transition hover:border-accent/50 hover:bg-surface-2"
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <p className="font-semibold">{item.displayName}</p>
        <span className="shrink-0 text-[11px] text-muted">{formatRelativeTime(item.lastMessageAt || item.commercialStageAt)}</span>
      </div>
      <p className="text-xs text-muted">{formatPhone(item.phone)}</p>
      <p className="mt-1 line-clamp-2 text-xs text-muted">{item.lastMessagePreview || "Sem mensagens"}</p>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <LeadStageBadge stage={item.commercialStage} />
        {item.waitlistMatches?.length ? (
          <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-medium text-emerald-300" title={item.waitlistMatches.map((match) => match.product?.serialOnyx).filter(Boolean).join(", ")}>
            Chegou {item.waitlistMatches.length === 1 ? item.waitlistMatches[0].product?.serialOnyx : `${item.waitlistMatches.length} unidades`}
          </span>
        ) : null}
        <span className="text-[11px] text-muted">{item.agent?.name || "Sem agente"}</span>
      </div>
      {item.team?.name ? <p className="mt-1 text-[11px] text-muted">{item.team.name}</p> : null}
    </button>
  );
}

export default function LeadsPage() {
  const router = useRouter();
  const [me, setMe] = useState(null);
  const [items, setItems] = useState([]);
  const [teams, setTeams] = useState([]);
  const [q, setQ] = useState("");
  const [teamId, setTeamId] = useState("");
  const [loading, setLoading] = useState(true);
  const [truncated, setTruncated] = useState(false);
  const [overStage, setOverStage] = useState("");
  const dragging = useRef(null);
  const skipClick = useRef(false);
  const [waitlistItem, setWaitlistItem] = useState(null);
  const [waitlistSaving, setWaitlistSaving] = useState(false);

  const canMove = me && can(me, PERMISSIONS.INBOX_REPLY);

  const load = useCallback(async (filters) => {
    setLoading(true);
    try {
      const search = new URLSearchParams();
      if (filters.q) search.set("q", filters.q);
      if (filters.teamId) search.set("teamId", filters.teamId);
      const data = await api(`/api/inbox/leads?${search.toString()}`);
      setItems(data.items || []);
      setTruncated(Boolean(data.truncated));
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    api("/api/auth/me").then((auth) => setMe(auth.user)).catch((error) => toast.error(error.message));
    api("/api/inbox/teams?active=true").then((data) => setTeams(data.items || [])).catch(() => {});
    void load({ q: "", teamId: "" });
  }, [load]);

  const columns = useMemo(() => {
    const grouped = Object.fromEntries(LEAD_BOARD_STAGES.map((stage) => [stage, []]));
    for (const item of items) {
      if (grouped[item.commercialStage]) grouped[item.commercialStage].push(item);
    }
    return LEAD_BOARD_STAGES.map((stage) => ({
      stage,
      label: LEAD_STAGE_LABELS[stage],
      items: grouped[stage],
    }));
  }, [items]);

  function openConversation(item) {
    if (skipClick.current) return;
    router.push(`/contact-center?conversationId=${item.id}`);
  }

  async function moveCard(item, stage) {
    if (!canMove || !item || item.commercialStage === stage) return;
    if (stage === LEAD_STAGES.NEW) {
      toast.message("A etapa Novo fica registrada quando a conversa chega.");
      return;
    }
    if (stage === LEAD_STAGES.WAITLIST) {
      setWaitlistItem(item);
      return;
    }
    const previous = items;
    setItems((current) => current.map((entry) => (
      entry.id === item.id
        ? { ...entry, commercialStage: stage, commercialStageAt: new Date().toISOString() }
        : entry
    )));
    try {
      await api(`/api/inbox/conversations/${item.id}/stage`, { method: "POST", json: { stage } });
    } catch (error) {
      setItems(previous);
      toast.error(error.message);
    }
  }

  return (
    <div className="w-full">
      <PageHeader
        title="Leads"
        subtitle="Acompanhe o contato até abrir a venda. A venda em andamento segue no quadro de Vendas, em Negociação."
      />

      <Card className="mb-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Buscar">
            <Input
              value={q}
              onChange={(event) => setQ(event.target.value)}
              placeholder="Nome, telefone ou mensagem"
              onKeyDown={(event) => {
                if (event.key === "Enter") void load({ q, teamId });
              }}
            />
          </Field>
          <Field label="Equipe">
            <Select value={teamId} onChange={(event) => setTeamId(event.target.value)}>
              <option value="">Todas as equipes</option>
              {teams.map((team) => (
                <option key={team.id} value={team.id}>{team.name}</option>
              ))}
            </Select>
          </Field>
        </div>
        <div className="mt-3 flex justify-end gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              setQ("");
              setTeamId("");
              void load({ q: "", teamId: "" });
            }}
          >
            Limpar
          </Button>
          <Button type="button" onClick={() => void load({ q, teamId })} disabled={loading}>
            {loading ? "Buscando..." : "Buscar"}
          </Button>
        </div>
      </Card>

      <WaitlistDialog
        open={Boolean(waitlistItem)}
        initial={waitlistItem}
        saving={waitlistSaving}
        onClose={() => !waitlistSaving && setWaitlistItem(null)}
        onSave={(form) => {
          if (!waitlistItem) return;
          const item = waitlistItem;
          setWaitlistSaving(true);
          api(`/api/inbox/conversations/${item.id}/stage`, {
            method: "POST",
            json: { stage: LEAD_STAGES.WAITLIST, ...form },
          })
            .then(() => {
              setWaitlistItem(null);
              toast.success("Etapa comercial: Lista de Espera.");
              return load({ q, teamId });
            })
            .catch((error) => toast.error(error.message))
            .finally(() => setWaitlistSaving(false));
        }}
      />

      {truncated ? (
        <p className="mb-3 text-sm text-muted">Mostrando os 400 contatos mais recentes. Use a busca para afunilar.</p>
      ) : null}

      <div className="overflow-x-auto pb-2">
        <div className="flex min-w-max gap-3">
          {columns.map((column) => {
            const acceptsDrop = canMove && column.stage !== LEAD_STAGES.NEW;
            return (
              <section
                key={column.stage}
                onDragOver={(event) => {
                  if (!canMove) return;
                  event.preventDefault();
                  if (acceptsDrop) setOverStage(column.stage);
                }}
                onDragLeave={() => setOverStage((current) => (current === column.stage ? "" : current))}
                onDrop={(event) => {
                  if (!canMove) return;
                  event.preventDefault();
                  setOverStage("");
                  const item = dragging.current;
                  dragging.current = null;
                  if (column.stage === LEAD_STAGES.NEW) {
                    toast.message("A etapa Novo fica registrada quando a conversa chega.");
                    return;
                  }
                  if (column.stage === LEAD_STAGES.WAITLIST) {
                    if (item) setWaitlistItem(item);
                    return;
                  }
                  void moveCard(item, column.stage);
                }}
                className={cn(
                  "flex w-72 shrink-0 flex-col rounded-2xl border border-border border-t-4 bg-surface-2/40",
                  COLUMN_TONES[column.stage] || "border-t-border",
                  overStage === column.stage && "ring-2 ring-accent/50",
                )}
              >
                <header className="flex items-center justify-between gap-2 px-3 py-3">
                  <div>
                    <p className="text-sm font-semibold">{column.label}</p>
                    <p className="text-xs text-muted">{column.items.length} conversa(s)</p>
                  </div>
                  <LeadStageBadge stage={column.stage} />
                </header>
                <div className="flex max-h-[calc(100vh-280px)] flex-col gap-2 overflow-y-auto px-3 pb-3">
                  {column.items.map((item) => (
                    <LeadCard
                      key={item.id}
                      item={item}
                      draggable={canMove}
                      onOpen={openConversation}
                      onDragStart={(entry) => {
                        skipClick.current = true;
                        dragging.current = entry;
                      }}
                      onDragEnd={() => {
                        dragging.current = null;
                        setOverStage("");
                        window.setTimeout(() => {
                          skipClick.current = false;
                        }, 80);
                      }}
                    />
                  ))}
                  {!column.items.length ? (
                    <p className="rounded-xl border border-dashed border-border px-3 py-6 text-center text-xs text-muted">
                      Nenhuma conversa nesta etapa
                    </p>
                  ) : null}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}
