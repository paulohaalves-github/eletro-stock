"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { api } from "@/lib/api-client";
import { Button, Card, PageHeader, Select } from "@/components/ui";
import { cn, formatCurrency, formatDateTime, formatProductId } from "@/lib/format";

const Charts = dynamic(() => import("@/components/sale-dashboard-charts"), { ssr: false });

function percent(value) {
  return `${((Number(value) || 0) * 100).toFixed(1).replace(".", ",")}%`;
}

function BreakdownTable({ title, empty, rows }) {
  return (
    <Card className="overflow-hidden p-0">
      <div className="border-b border-border px-5 py-4">
        <h2 className="font-semibold">{title}</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-5 py-3 font-semibold">Nome</th>
              <th className="px-5 py-3 font-semibold">Itens</th>
              <th className="px-5 py-3 font-semibold">Faturamento</th>
              <th className="px-5 py-3 font-semibold">Participação</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-border">
                <td className="px-5 py-3 font-medium">{row.name}</td>
                <td className="px-5 py-3 tabular-nums text-muted">{row.count}</td>
                <td className="px-5 py-3 tabular-nums">{formatCurrency(row.amount)}</td>
                <td className="px-5 py-3 tabular-nums text-muted">{percent(row.share)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!rows.length ? <p className="px-5 py-6 text-sm text-muted">{empty}</p> : null}
    </Card>
  );
}

function CustomerTable({ title, empty, rows, mode = "revenue" }) {
  return (
    <Card className="overflow-hidden p-0">
      <div className="border-b border-border px-5 py-4">
        <h2 className="font-semibold">{title}</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-5 py-3 font-semibold">Cliente</th>
              <th className="px-5 py-3 font-semibold">Compras</th>
              <th className="px-5 py-3 font-semibold">Itens</th>
              <th className="px-5 py-3 font-semibold">Ticket médio</th>
              <th className="px-5 py-3 font-semibold">Faturamento</th>
              {mode === "revenue" ? <th className="px-5 py-3 font-semibold">Participação</th> : null}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={`${mode}-${row.id || row.name}`} className="border-t border-border">
                <td className="px-5 py-3 font-medium">
                  {row.id ? (
                    <Link href={`/clientes/${row.id}`} className="hover:text-accent">
                      {row.name}
                    </Link>
                  ) : (
                    row.name
                  )}
                  <span className="mt-0.5 block text-xs font-normal text-muted">
                    {row.returning ? "Já comprava antes" : "Novo no período"}
                    {row.recurring ? " · recorrente no período" : ""}
                  </span>
                </td>
                <td className="px-5 py-3 tabular-nums text-muted">{row.orderCount}</td>
                <td className="px-5 py-3 tabular-nums text-muted">{row.itemCount}</td>
                <td className="px-5 py-3 tabular-nums">{formatCurrency(row.ticket)}</td>
                <td className="px-5 py-3 tabular-nums">{formatCurrency(row.amount)}</td>
                {mode === "revenue" ? (
                  <td className="px-5 py-3 tabular-nums text-muted">{percent(row.share)}</td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!rows.length ? <p className="px-5 py-6 text-sm text-muted">{empty}</p> : null}
    </Card>
  );
}

function PerformanceView({ data }) {
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {[
          ["Faturamento", formatCurrency(data.cards.amount)],
          ["Referência tabela", formatCurrency(data.cards.listPrice || 0)],
          ["Desconto concedido", formatCurrency(data.cards.discount || 0)],
          ["Produtos baixados", data.cards.count],
          ["Ticket médio", formatCurrency(data.cards.ticket)],
          ["Vendas com baixa", data.cards.orders],
        ].map(([label, value]) => (
          <Card key={label} className="p-4">
            <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
            <p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p>
            {label === "Referência tabela" && data.cards.pricedCount != null ? (
              <p className="mt-1 text-xs text-muted">
                {data.cards.pricedCount} de {data.cards.count} com pagamento classificado
              </p>
            ) : null}
            {label === "Desconto concedido" ? (
              <p className="mt-1 text-xs text-muted">Só valores vendidos abaixo da tabela</p>
            ) : null}
          </Card>
        ))}
      </div>

      {data.pipeline?.length ? (
        <div className="mt-4 space-y-2">
          <p className="text-xs uppercase tracking-wide text-muted">Funil atual (vendas em aberto)</p>
          <div className="flex flex-wrap gap-2">
            {data.pipeline.map((item) => (
              <span key={item.status} className="rounded-full border border-border bg-surface px-3 py-1 text-xs text-muted">
                {item.label}: <span className="font-semibold text-text">{item.count}</span>
              </span>
            ))}
          </div>
        </div>
      ) : null}
      {data.periodPipeline?.length ? (
        <div className="mt-3 space-y-2">
          <p className="text-xs uppercase tracking-wide text-muted">Abertas no período</p>
          <div className="flex flex-wrap gap-2">
            {data.periodPipeline.map((item) => (
              <span key={item.status} className="rounded-full border border-border bg-surface px-3 py-1 text-xs text-muted">
                {item.label}: <span className="font-semibold text-text">{item.count}</span>
              </span>
            ))}
          </div>
        </div>
      ) : null}

      <Charts byType={data.byType} daily={data.daily} />

      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        <BreakdownTable title="Por quem reservou" empty="Nenhuma baixa com reserva no período." rows={data.byReserver || []} />
        <BreakdownTable title="Por vendedor" empty="Nenhuma baixa por vendedor no período." rows={data.bySeller} />
        <BreakdownTable title="Por tipo de produto" empty="Nenhuma baixa por categoria no período." rows={data.byType} />
        <BreakdownTable title="Por atendente" empty="Nenhuma baixa por atendente no período." rows={data.byAttendant} />
        <BreakdownTable title="Por forma de pagamento" empty="Nenhuma baixa com forma de pagamento no período." rows={data.byPayment} />
      </div>

      <Card className="mt-6">
        <h2 className="mb-3 font-semibold">Baixas recentes</h2>
        <div className="space-y-3">
          {(data.recent || []).map((item) => (
            <Link
              key={item.id}
              href={item.productId ? `/estoque/${item.productId}` : "/vendas"}
              className="flex items-center gap-3 rounded-xl p-2 hover:bg-surface-2"
            >
              <img src={item.imageUrl || "/logo.svg"} alt="" className="h-11 w-11 rounded-lg object-cover" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {item.productId ? `${formatProductId(item.productId)} · ` : ""}
                  {item.commercialName}
                </p>
                <p className="text-xs text-muted">
                  {formatDateTime(item.soldAt)}
                  {item.saleNumber ? ` · ${item.saleNumber}` : ""}
                  {` · ${item.sellerName}`}
                  {item.paymentLabel && item.paymentLabel !== "Não informado" ? ` · ${item.paymentLabel}` : ""}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold tabular-nums">{formatCurrency(item.amount)}</p>
                {item.discount != null ? (
                  <p className={`text-xs tabular-nums ${item.discount > 0 ? "text-accent" : "text-muted"}`}>
                    {item.discount > 0
                      ? `−${formatCurrency(item.discount)}`
                      : item.discount < 0
                        ? `+${formatCurrency(Math.abs(item.discount))} acima`
                        : "sem desconto"}
                  </p>
                ) : (
                  <p className="text-xs text-muted">sem referência</p>
                )}
              </div>
            </Link>
          ))}
          {!data.recent?.length ? <p className="text-sm text-muted">Nenhum produto baixado neste período.</p> : null}
        </div>
      </Card>
    </>
  );
}

function CustomersView({ data }) {
  const customers = data.customers || {
    cards: {},
    byRevenue: [],
    byFrequency: [],
    byTicket: [],
    segments: [],
  };
  const cards = customers.cards || {};

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wide text-muted">Clientes ativos</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums">{cards.activeCustomers || 0}</p>
          <p className="mt-1 text-xs text-muted">Com compra no período</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wide text-muted">Recorrentes no período</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums">{cards.recurringCustomers || 0}</p>
          <p className="mt-1 text-xs text-muted">{percent(cards.recurringShare)} da carteira</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wide text-muted">Ticket por cliente</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums">{formatCurrency(cards.ticketPerCustomer || 0)}</p>
          <p className="mt-1 text-xs text-muted">Faturamento ÷ clientes</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wide text-muted">Concentração top 20%</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums">{percent(cards.top20Share)}</p>
          <p className="mt-1 text-xs text-muted">Participação dos maiores clientes</p>
        </Card>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {(customers.segments || []).map((segment) => (
          <Card key={segment.id} className="p-4">
            <p className="text-xs uppercase tracking-wide text-muted">{segment.name}</p>
            <p className="mt-2 text-xl font-semibold tabular-nums">{formatCurrency(segment.amount)}</p>
            <p className="mt-1 text-xs text-muted">
              {segment.count} cliente(s) · {percent(segment.share)} do faturamento
            </p>
          </Card>
        ))}
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        <CustomerTable
          title="Mais rentáveis"
          empty="Nenhum cliente com compra no período."
          rows={customers.byRevenue || []}
          mode="revenue"
        />
        <CustomerTable
          title="Mais recorrentes"
          empty="Nenhum cliente com 2 ou mais compras no período."
          rows={customers.byFrequency || []}
          mode="frequency"
        />
        <div className="xl:col-span-2">
          <CustomerTable
            title="Maior ticket médio"
            empty="Nenhum cliente com compra no período."
            rows={customers.byTicket || []}
            mode="ticket"
          />
        </div>
      </div>
    </>
  );
}

export function SalesDashboard({ embedded = false }) {
  const [period, setPeriod] = useState("30d");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [tab, setTab] = useState("performance");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  async function loadDashboard(nextPeriod = period, nextFrom = from, nextTo = to) {
    const query = new URLSearchParams({ period: nextPeriod });
    if (nextPeriod === "custom" && nextFrom && nextTo) {
      query.set("from", nextFrom);
      query.set("to", nextTo);
    }
    setLoading(true);
    try {
      setData(await api(`/api/sale-orders/dashboard?${query}`));
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!data && loading) {
    return <p className="text-muted">Carregando dashboard...</p>;
  }

  if (!data) {
    return <p className="text-muted">Não foi possível carregar o dashboard comercial.</p>;
  }

  return (
    <div>
      <PageHeader
        kicker={embedded ? null : "Eletro-Stock"}
        title={embedded ? null : "Dashboard comercial"}
        subtitle={
          data.unit
            ? `Faturamento pelo valor vendido na baixa, em ${data.unit.name}. Desconto compara com à vista (1x) ou parcelado (2x+), conforme o recebimento. Vendedor é o responsável pela venda; quem reservou é quem fez a reserva; atendente é quem concluiu a baixa.`
            : "Faturamento pelo valor vendido na baixa."
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <Select value={period} onChange={(e) => setPeriod(e.target.value)}>
              <option value="today">Hoje</option>
              <option value="7d">7 dias</option>
              <option value="30d">30 dias</option>
              <option value="90d">90 dias</option>
              <option value="custom">Personalizado</option>
            </Select>
            {period === "custom" ? (
              <>
                <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="rounded-xl border border-border bg-bg px-3 py-2 text-sm" />
                <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="rounded-xl border border-border bg-bg px-3 py-2 text-sm" />
              </>
            ) : null}
            <Button type="button" onClick={() => void loadDashboard()} disabled={loading}>
              {loading ? "Buscando..." : "Buscar"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={loading}
              onClick={() => {
                setPeriod("30d");
                setFrom("");
                setTo("");
                void loadDashboard("30d", "", "");
              }}
            >
              Limpar filtros
            </Button>
          </div>
        }
      />

      <div
        className="mb-5 flex w-full flex-col gap-1 rounded-2xl border border-border bg-surface p-1 sm:w-auto sm:flex-row"
        role="tablist"
        aria-label="Visão do dashboard comercial"
      >
        {[
          { id: "performance", label: "Desempenho" },
          { id: "customers", label: "Clientes" },
        ].map((item) => {
          const active = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(item.id)}
              className={cn(
                "inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold transition",
                active ? "bg-accent/15 text-accent" : "text-muted hover:bg-surface-2 hover:text-text",
              )}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      {tab === "performance" ? <PerformanceView data={data} /> : <CustomersView data={data} />}
    </div>
  );
}
