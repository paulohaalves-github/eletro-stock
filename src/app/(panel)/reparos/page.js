"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { api } from "@/lib/api-client";
import { Button, Card, Input, PageHeader, Select } from "@/components/ui";
import { LoadMore, SearchActions } from "@/components/paged-list";
import { WorkOrderStatusBadge } from "@/components/badges";
import { SERVICE_PLACE_LABELS, WORK_ORDER_STATUS_LABELS } from "@/lib/constants";
import { formatDateTime, formatProductId } from "@/lib/format";
import { listQuery } from "@/lib/pagination";
import { usePagedList } from "@/hooks/use-paged-list";
import { can, PERMISSIONS } from "@/lib/permissions";

const KANBAN_STATUSES = Object.keys(WORK_ORDER_STATUS_LABELS);

const COLUMN_TONES = {
  ABERTA: "border-sky-500/40",
  EM_ANALISE: "border-cyan-500/40",
  AGUARDANDO_PECA: "border-amber-500/40",
  EM_REPARO: "border-orange-500/40",
  PRONTO: "border-emerald-500/40",
  ENTREGUE: "border-slate-500/40",
  SEM_REPARO: "border-rose-500/40",
  CANCELADA: "border-rose-500/40",
};

function WorkOrderCard({ item, onOpen }) {
  return (
    <button
      type="button"
      onClick={() => onOpen(item.id)}
      className="w-full rounded-xl border border-border bg-surface p-3 text-left transition hover:border-accent/50 hover:bg-surface-2"
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <p className="font-semibold text-accent">{item.number}</p>
        <span className="text-[11px] text-muted">{SERVICE_PLACE_LABELS[item.servicePlace]}</span>
      </div>
      <p className="line-clamp-2 text-sm font-medium">
        {item.commercialName || item.product?.serialOnyx || "—"}
      </p>
      <p className="mt-1 text-xs text-muted">{formatProductId(item.productId)}</p>
      <p className="mt-2 text-sm text-muted">{item.customer?.name || "—"}</p>
      <p className="mt-2 text-[11px] text-muted">{formatDateTime(item.openedAt)}</p>
    </button>
  );
}

export default function ReparosPage() {
  const router = useRouter();
  const list = usePagedList();
  const [me, setMe] = useState(null);
  const [view, setView] = useState("table");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [servicePlace, setServicePlace] = useState("");

  function loader(page, pageSize) {
    return api(`/api/work-orders?${listQuery({ q, status, servicePlace }, page, pageSize)}`);
  }

  useEffect(() => {
    api("/api/auth/me").then((auth) => setMe(auth.user)).catch((error) => toast.error(error.message));
    void list.search(loader);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const canCreate = me && can(me.role, PERMISSIONS.REPAIR_CREATE);

  const kanbanColumns = useMemo(() => {
    const statuses = status ? [status] : KANBAN_STATUSES;
    const grouped = Object.fromEntries(statuses.map((value) => [value, []]));
    for (const item of list.items) {
      if (grouped[item.status]) grouped[item.status].push(item);
    }
    return statuses.map((value) => ({
      status: value,
      label: WORK_ORDER_STATUS_LABELS[value] || value,
      items: grouped[value] || [],
    }));
  }, [list.items, status]);

  function openOrder(id) {
    router.push(`/reparos/${id}`);
  }

  return (
    <div className="w-full">
      <PageHeader
        title="Ordens de serviço"
        subtitle="Acompanhe o reparo na garantia, no laboratório do grupo ou na casa do cliente."
        actions={
          <>
            <Button
              variant="secondary"
              onClick={() => setView(view === "table" ? "kanban" : "table")}
            >
              {view === "table" ? "Ver kanban" : "Ver tabela"}
            </Button>
            {canCreate ? <Button onClick={() => router.push("/reparos/novo")}>Nova OS</Button> : null}
          </>
        }
      />
      <Card className="mb-4 space-y-3">
        <div className="grid gap-3 sm:grid-cols-3">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="OS, serial, cliente ou defeito" />
          <Select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Todos os status</option>
            {Object.entries(WORK_ORDER_STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </Select>
          <Select value={servicePlace} onChange={(e) => setServicePlace(e.target.value)}>
            <option value="">Todos os locais</option>
            {Object.entries(SERVICE_PLACE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </Select>
        </div>
        <SearchActions loading={list.loading} onSearch={() => void list.search(loader)} />
      </Card>

      {view === "kanban" ? (
        <div className="overflow-x-auto pb-2">
          <div className="flex min-w-max gap-3">
            {kanbanColumns.map((column) => (
              <section
                key={column.status}
                className={`flex w-72 shrink-0 flex-col rounded-2xl border border-border border-t-4 bg-surface-2/40 ${COLUMN_TONES[column.status] || "border-t-border"}`}
              >
                <header className="flex items-center justify-between gap-2 px-3 py-3">
                  <div>
                    <p className="text-sm font-semibold">{column.label}</p>
                    <p className="text-xs text-muted">{column.items.length} ordem(ns)</p>
                  </div>
                  <WorkOrderStatusBadge status={column.status} />
                </header>
                <div className="flex max-h-[calc(100vh-280px)] flex-col gap-2 overflow-y-auto px-3 pb-3">
                  {column.items.map((item) => (
                    <WorkOrderCard key={item.id} item={item} onOpen={openOrder} />
                  ))}
                  {!column.items.length ? (
                    <p className="rounded-xl border border-dashed border-border px-3 py-6 text-center text-xs text-muted">
                      Nenhuma OS neste status
                    </p>
                  ) : null}
                </div>
              </section>
            ))}
          </div>
          {!list.items.length ? (
            <p className="mt-4 text-sm text-muted">Nenhuma ordem de serviço encontrada.</p>
          ) : null}
        </div>
      ) : (
        <Card className="w-full overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-5 py-3 font-semibold">OS</th>
                  <th className="px-5 py-3 font-semibold">Produto</th>
                  <th className="px-5 py-3 font-semibold">Cliente</th>
                  <th className="px-5 py-3 font-semibold">Local</th>
                  <th className="px-5 py-3 font-semibold">Abertura</th>
                  <th className="px-5 py-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {list.items.map((item) => (
                  <tr
                    key={item.id}
                    className="cursor-pointer border-t border-border hover:bg-surface-2/80"
                    onClick={() => openOrder(item.id)}
                  >
                    <td className="px-5 py-4 font-semibold text-accent">{item.number}</td>
                    <td className="px-5 py-4">
                      <p className="font-medium">{item.commercialName || item.product?.serialOnyx}</p>
                      <p className="text-xs text-muted">{formatProductId(item.productId)}</p>
                    </td>
                    <td className="px-5 py-4">{item.customer?.name}</td>
                    <td className="px-5 py-4 text-muted">{SERVICE_PLACE_LABELS[item.servicePlace]}</td>
                    <td className="px-5 py-4 text-muted">{formatDateTime(item.openedAt)}</td>
                    <td className="px-5 py-4"><WorkOrderStatusBadge status={item.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!list.items.length ? <p className="px-5 py-6 text-sm text-muted">Nenhuma ordem de serviço encontrada.</p> : null}
        </Card>
      )}
      <LoadMore
        shown={list.items.length}
        total={list.total}
        hasMore={list.hasMore}
        loading={list.loadingMore}
        onClick={() => void list.loadMore()}
      />
    </div>
  );
}
