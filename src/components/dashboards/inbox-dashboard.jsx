"use client";

import { useEffect, useRef, useState } from "react";
import { Funnel, X } from "lucide-react";
import { api } from "@/lib/api-client";
import { Button, Card, Field, PageHeader, Select } from "@/components/ui";
import { cn } from "@/lib/format";

function Metric({ label, value }) {
  return (
    <Card className="p-4">
      <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p>
    </Card>
  );
}

function CountTable({ title, columns, rows, empty }) {
  return (
    <Card className="overflow-hidden p-0">
      <div className="border-b border-border px-5 py-4">
        <h2 className="font-semibold">{title}</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-muted">
            <tr>
              {columns.map((column) => (
                <th key={column} className="px-5 py-3 font-semibold">{column}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-border">
                {row.cells.map((cell, index) => (
                  <td
                    key={`${row.id}-${index}`}
                    className={index === 0 || typeof cell !== "number" ? "px-5 py-3 font-medium" : "px-5 py-3 tabular-nums text-muted"}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!rows.length ? <p className="px-5 py-6 text-sm text-muted">{empty}</p> : null}
    </Card>
  );
}

const EMPTY_FILTERS = { rangeType: "started", period: "all", from: "", to: "", channelId: "" };

const PERIOD_OPTIONS = [
  { value: "all", label: "Qualquer data" },
  { value: "today", label: "Hoje" },
  { value: "7d", label: "Últimos 7 dias" },
  { value: "30d", label: "Últimos 30 dias" },
  { value: "90d", label: "Últimos 90 dias" },
  { value: "custom", label: "Personalizado" },
];

function formatDay(value) {
  if (!value) return "";
  const [year, month, day] = String(value).split("-");
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
}

function periodChipText(filters) {
  if (filters.period === "all") return null;
  if (filters.period === "custom") {
    if (filters.from && filters.to) return `${formatDay(filters.from)} a ${formatDay(filters.to)}`;
    return "Período personalizado";
  }
  return PERIOD_OPTIONS.find((item) => item.value === filters.period)?.label || null;
}

function Chip({ label, onRemove }) {
  return (
    <span className="inline-flex max-w-full items-center gap-1 rounded-full bg-accent/15 px-2.5 py-1 text-xs font-semibold text-accent">
      <span className="truncate">{label}</span>
      <button type="button" onClick={onRemove} className="rounded-full p-0.5 hover:bg-accent/20" aria-label={`Remover filtro ${label}`}>
        <X size={12} />
      </button>
    </span>
  );
}

export function InboxDashboard({ embedded = false }) {
  const [rangeType, setRangeType] = useState(EMPTY_FILTERS.rangeType);
  const [period, setPeriod] = useState(EMPTY_FILTERS.period);
  const [from, setFrom] = useState(EMPTY_FILTERS.from);
  const [to, setTo] = useState(EMPTY_FILTERS.to);
  const [channelId, setChannelId] = useState(EMPTY_FILTERS.channelId);
  const [applied, setApplied] = useState(EMPTY_FILTERS);
  const [open, setOpen] = useState(false);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const filterRef = useRef(null);

  const draft = { rangeType, period, from, to, channelId };

  function queryFrom(next = {}) {
    const nextPeriod = next.period ?? period;
    const nextFrom = next.from ?? from;
    const nextTo = next.to ?? to;
    const nextChannel = next.channelId ?? channelId;
    const query = new URLSearchParams({
      rangeType: next.rangeType ?? rangeType,
      period: nextPeriod,
    });
    if (nextPeriod === "custom" && nextFrom && nextTo) {
      query.set("from", nextFrom);
      query.set("to", nextTo);
    }
    if (nextChannel) query.set("channelId", nextChannel);
    return query;
  }

  async function loadDashboard(next = draft) {
    setLoading(true);
    try {
      setData(await api(`/api/inbox/dashboard?${queryFrom(next)}`));
      setApplied(next);
      setOpen(false);
    } catch {
      setData((current) => current);
    } finally {
      setLoading(false);
    }
  }

  function syncDraft(next) {
    setRangeType(next.rangeType);
    setPeriod(next.period);
    setFrom(next.from || "");
    setTo(next.to || "");
    setChannelId(next.channelId || "");
  }

  function clearFilters() {
    syncDraft(EMPTY_FILTERS);
    void loadDashboard(EMPTY_FILTERS);
  }

  function removeChip(patch) {
    const next = { ...applied, ...patch };
    syncDraft(next);
    void loadDashboard(next);
  }

  useEffect(() => {
    void loadDashboard(EMPTY_FILTERS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    function onPointer(event) {
      if (filterRef.current && !filterRef.current.contains(event.target)) setOpen(false);
    }
    function onKey(event) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointer);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!data && loading) {
    return <p className="text-muted">Carregando dashboard...</p>;
  }

  if (!data) {
    return <p className="text-muted">Não foi possível carregar o dashboard.</p>;
  }

  const channelName = (data.channels || []).find((channel) => String(channel.id) === String(applied.channelId))?.name;
  const periodLabel = periodChipText(applied);
  const chips = [
    applied.rangeType === "closed" ? { key: "range", label: "Encerradas", patch: { rangeType: "started" } } : null,
    periodLabel ? { key: "period", label: periodLabel, patch: { period: "all", from: "", to: "" } } : null,
    channelName ? { key: "channel", label: `Canal: ${channelName}`, patch: { channelId: "" } } : null,
  ].filter(Boolean);

  return (
    <div>
      <PageHeader
        kicker={embedded ? null : "Eletro-Stock"}
        title={embedded ? null : "Dashboard"}
        subtitle="Contagem das conversas por fila, canal, atendente e status."
      />

      <div className="relative mx-auto mb-6 w-full max-w-2xl" ref={filterRef}>
        <div
          className="flex w-full cursor-pointer items-center gap-2 rounded-2xl border border-border bg-surface px-3 py-2 shadow-sm transition hover:border-accent/40"
          onClick={() => {
            if (!open) syncDraft(applied);
            setOpen(true);
          }}
        >
          <Funnel size={16} className="shrink-0 text-muted" />
          <div className="flex min-h-8 min-w-0 flex-1 flex-wrap items-center gap-1.5">
            {chips.length ? chips.map((chip) => (
              <Chip
                key={chip.key}
                label={chip.label}
                onRemove={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  removeChip(chip.patch);
                }}
              />
            )) : (
              <span className="text-sm text-muted">Filtrar por canal e período</span>
            )}
          </div>
        </div>

        {open ? (
          <div className="absolute left-1/2 z-20 mt-2 w-[min(100%,28rem)] -translate-x-1/2 rounded-2xl border border-border bg-surface p-5 shadow-2xl">
            <div className="space-y-4">
              <Field label="Canal">
                <Select value={channelId} onChange={(e) => setChannelId(e.target.value)}>
                  <option value="">Todos os canais</option>
                  {(data.channels || []).map((channel) => (
                    <option key={channel.id} value={channel.id}>{channel.name}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Período">
                <Select value={period} onChange={(e) => setPeriod(e.target.value)}>
                  {PERIOD_OPTIONS.map((item) => (
                    <option key={item.value} value={item.value}>{item.label}</option>
                  ))}
                </Select>
              </Field>
              {period === "custom" ? (
                <div className="grid grid-cols-2 gap-3">
                  <Field label="De">
                    <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-full rounded-xl border border-border bg-bg px-3.5 py-2.5 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20" />
                  </Field>
                  <Field label="Até">
                    <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-full rounded-xl border border-border bg-bg px-3.5 py-2.5 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20" />
                  </Field>
                </div>
              ) : null}
              <Field label="Conversas">
                <Select value={rangeType} onChange={(e) => setRangeType(e.target.value)}>
                  <option value="started">Iniciadas</option>
                  <option value="closed">Encerradas</option>
                </Select>
              </Field>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={clearFilters} disabled={loading}>Limpar</Button>
              <Button type="button" onClick={() => void loadDashboard(draft)} disabled={loading}>
                {loading ? "Aplicando..." : "Aplicar"}
              </Button>
            </div>
          </div>
        ) : null}
      </div>

      <div className={cn("grid gap-3 sm:grid-cols-2 xl:grid-cols-4", loading ? "opacity-70" : "")}>
        <Metric label="Abertas" value={data.cards.open} />
        <Metric label="Aguardando agente" value={data.cards.waiting} />
        <Metric label="Agente respondeu" value={data.cards.replied} />
        <Metric label="Encerradas" value={data.cards.closed} />
        <Metric label="Sem agente" value={data.cards.unassigned} />
        <Metric label="Encerradas hoje" value={data.cards.closedToday} />
        <Metric label="Espera média" value={data.cards.avgWait} />
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        <CountTable
          title="Por fila"
          columns={["Fila", "Abertas", "Aguardando", "Respondidas", "Sem agente", "Encerradas"]}
          empty="Nenhuma fila supervisionada."
          rows={data.byTeam.map((team) => ({
            id: `team-${team.id}`,
            cells: [
              <span key={team.id} className="inline-flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: team.color }} />
                {team.name}
              </span>,
              team.open,
              team.waiting,
              team.replied,
              team.unassigned,
              team.closed,
            ],
          }))}
        />
        <CountTable
          title="Por canal"
          columns={["Canal", "Origem", "Abertas", "Aguardando", "Respondidas", "Encerradas"]}
          empty="Nenhum canal nas filas supervisionadas."
          rows={(data.byChannel || []).map((channel) => ({
            id: `channel-${channel.id}`,
            cells: [channel.name, channel.providerLabel, channel.open, channel.waiting, channel.replied, channel.closed],
          }))}
        />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <CountTable
          title="Por atendente"
          columns={["Atendente", "Abertas", "Aguardando", "Respondidas", "Encerradas"]}
          empty="Nenhum atendente nas filas supervisionadas."
          rows={data.byAgent.map((agent) => ({
            id: `agent-${agent.id ?? "none"}`,
            cells: [agent.name, agent.open, agent.waiting, agent.replied, agent.closed],
          }))}
        />
        <CountTable
          title="Por status"
          columns={["Status", "Conversas"]}
          empty="Nenhuma conversa."
          rows={data.byStatus.map((item) => ({
            id: item.status,
            cells: [item.label, item.count],
          }))}
        />
      </div>
    </div>
  );
}
