"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { api } from "@/lib/api-client";
import { Button, Card, Field, Input, PageHeader, Select } from "@/components/ui";
import { LoadMore, SearchActions } from "@/components/paged-list";
import { SaleOrderStatusBadge } from "@/components/badges";
import { SALE_ORDER_STATUS_LABELS } from "@/lib/constants";
import { formatDateTime } from "@/lib/format";
import { listQuery } from "@/lib/pagination";
import { usePagedList } from "@/hooks/use-paged-list";
import { can, canViewAllSaleOrders, PERMISSIONS } from "@/lib/permissions";

const KANBAN_STATUSES = Object.keys(SALE_ORDER_STATUS_LABELS);

const COLUMN_TONES = {
  INTERESSE: "border-sky-500/40",
  RESERVADA: "border-amber-500/40",
  PEDIDO: "border-violet-500/40",
  PARCIAL: "border-orange-500/40",
  CONCRETIZADA: "border-emerald-500/40",
  PERDIDA: "border-rose-500/40",
  CANCELADA: "border-slate-500/40",
};

function productSummary(item) {
  const names = (item.items || [])
    .map((row) => row.commercialName || row.product?.catalogModel?.commercialName || row.product?.serialOnyx)
    .filter(Boolean);
  if (!names.length) return "Sem produtos";
  if (names.length <= 2) return names.join(", ");
  return `${names.slice(0, 2).join(", ")} +${names.length - 2}`;
}

function SaleCard({ item, onOpen }) {
  return (
    <button
      type="button"
      onClick={() => onOpen(item.id)}
      className="w-full rounded-xl border border-border bg-surface p-3 text-left transition hover:border-accent/50 hover:bg-surface-2"
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <p className="font-semibold text-accent">{item.number}</p>
        <span className="text-[11px] text-muted">{item.itemCounts?.total || 0} item(ns)</span>
      </div>
      <p className="line-clamp-2 text-sm font-medium">{item.customer?.name || "—"}</p>
      <p className="mt-1 text-xs text-muted">Vendedor: {item.seller?.name || "—"}</p>
      <p className="mt-1 line-clamp-2 text-xs text-muted">{productSummary(item)}</p>
      <p className="mt-2 text-[11px] text-muted">Abertura: {formatDateTime(item.createdAt)}</p>
    </button>
  );
}

export default function VendasPage() {
  const router = useRouter();
  const list = usePagedList();
  const [me, setMe] = useState(null);
  const [view, setView] = useState("table");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [sellerId, setSellerId] = useState("");
  const [sellers, setSellers] = useState([]);

  function currentFilters() {
    return { q, status, sellerId };
  }

  function loader(page, pageSize, filters = currentFilters()) {
    return api(`/api/sale-orders?${listQuery(filters, page, pageSize)}`);
  }

  function clearFilters() {
    setQ("");
    setStatus("");
    setSellerId("");
    void list.search((page, pageSize) => loader(page, pageSize, { q: "", status: "", sellerId: "" }));
  }

  useEffect(() => {
    api("/api/auth/me").then((auth) => setMe(auth.user)).catch((error) => toast.error(error.message));
    api("/api/sale-orders/sellers")
      .then((data) => setSellers(data.items || []))
      .catch((error) => toast.error(error.message));
    void list.search(loader);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const canCreate = me && can(me.role, PERMISSIONS.SALE_CREATE);

  const kanbanColumns = useMemo(() => {
    const statuses = status ? [status] : KANBAN_STATUSES;
    const grouped = Object.fromEntries(statuses.map((value) => [value, []]));
    for (const item of list.items) {
      if (grouped[item.status]) grouped[item.status].push(item);
    }
    return statuses.map((value) => ({
      status: value,
      label: SALE_ORDER_STATUS_LABELS[value] || value,
      items: grouped[value] || [],
    }));
  }, [list.items, status]);

  return (
    <div className="w-full">
      <PageHeader
        title="Vendas"
        subtitle="Acompanhe o interesse do cliente, a reserva, o pedido e a baixa no caixa."
        actions={
          <>
            <Button variant="secondary" onClick={() => setView(view === "table" ? "kanban" : "table")}>
              {view === "table" ? "Ver kanban" : "Ver tabela"}
            </Button>
            {canCreate ? <Button onClick={() => router.push("/vendas/novo")}>Nova venda</Button> : null}
          </>
        }
      />

      <Card className="mb-4 space-y-3">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <Field label="Buscar">
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Número, cliente, serial ou observação" />
          </Field>
          <Field label="Status">
            <Select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">Todos os status</option>
              {Object.entries(SALE_ORDER_STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </Select>
          </Field>
          <Field label="Vendedor">
            <Select value={sellerId} onChange={(e) => setSellerId(e.target.value)} disabled={!me || !canViewAllSaleOrders(me.role)}>
              <option value="">{me && canViewAllSaleOrders(me.role) ? "Todos os vendedores" : (me?.name || "Meu usuário")}</option>
              {sellers.map((seller) => (
                <option key={seller.id} value={seller.id}>{seller.name}</option>
              ))}
            </Select>
          </Field>
        </div>
        <SearchActions loading={list.loading} onSearch={() => void list.search(loader)} onClear={clearFilters} />
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
                    <p className="text-xs text-muted">{column.items.length} venda(s)</p>
                  </div>
                  <SaleOrderStatusBadge status={column.status} />
                </header>
                <div className="flex max-h-[calc(100vh-280px)] flex-col gap-2 overflow-y-auto px-3 pb-3">
                  {column.items.map((item) => (
                    <SaleCard key={item.id} item={item} onOpen={(id) => router.push(`/vendas/${id}`)} />
                  ))}
                  {!column.items.length ? (
                    <p className="rounded-xl border border-dashed border-border px-3 py-6 text-center text-xs text-muted">
                      Nenhuma venda neste status
                    </p>
                  ) : null}
                </div>
              </section>
            ))}
          </div>
          {!list.items.length ? <p className="mt-4 text-sm text-muted">Nenhuma venda encontrada.</p> : null}
        </div>
      ) : (
        <Card className="w-full overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-5 py-3 font-semibold">Venda</th>
                  <th className="px-5 py-3 font-semibold">Cliente</th>
                  <th className="px-5 py-3 font-semibold">Vendedor</th>
                  <th className="px-5 py-3 font-semibold">Produtos</th>
                  <th className="px-5 py-3 font-semibold">Abertura</th>
                  <th className="px-5 py-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {list.items.map((item) => (
                  <tr
                    key={item.id}
                    className="cursor-pointer border-t border-border hover:bg-surface-2/80"
                    onClick={() => router.push(`/vendas/${item.id}`)}
                  >
                    <td className="px-5 py-4 font-semibold text-accent">{item.number}</td>
                    <td className="px-5 py-4">{item.customer?.name || "—"}</td>
                    <td className="px-5 py-4">{item.seller?.name || "—"}</td>
                    <td className="px-5 py-4">
                      <p className="font-medium">{productSummary(item)}</p>
                      <p className="text-xs text-muted">{item.itemCounts?.total || 0} item(ns)</p>
                    </td>
                    <td className="px-5 py-4 text-muted">{formatDateTime(item.createdAt)}</td>
                    <td className="px-5 py-4"><SaleOrderStatusBadge status={item.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!list.items.length ? <p className="px-5 py-6 text-sm text-muted">Nenhuma venda encontrada.</p> : null}
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
