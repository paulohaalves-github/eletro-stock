"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { api } from "@/lib/api-client";
import { Button, Card, PageHeader, Select } from "@/components/ui";
import { formatCurrency, formatDateTime, formatProductId } from "@/lib/format";

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

export function SalesDashboard({ embedded = false }) {
  const [period, setPeriod] = useState("30d");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
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

  const cards = [
    ["Faturamento", formatCurrency(data.cards.amount)],
    ["Produtos baixados", data.cards.count],
    ["Ticket médio", formatCurrency(data.cards.ticket)],
    ["Vendas com baixa", data.cards.orders],
  ];

  return (
    <div>
      <PageHeader
        kicker={embedded ? null : "Eletro-Stock"}
        title={embedded ? null : "Dashboard comercial"}
        subtitle={
          data.unit
            ? `Faturamento dos produtos baixados em ${data.unit.name}. Vendedor é o responsável pela venda; atendente é quem concluiu a baixa.`
            : "Faturamento dos produtos baixados no caixa."
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

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(([label, value]) => (
          <Card key={label} className="p-4">
            <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
            <p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p>
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

      <div className="mt-6 grid gap-4 xl:grid-cols-3">
        <BreakdownTable title="Por tipo de produto" empty="Nenhuma baixa por categoria no período." rows={data.byType} />
        <BreakdownTable title="Por vendedor" empty="Nenhuma baixa por vendedor no período." rows={data.bySeller} />
        <BreakdownTable title="Por atendente" empty="Nenhuma baixa por atendente no período." rows={data.byAttendant} />
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
                </p>
              </div>
              <p className="text-sm font-semibold tabular-nums">{formatCurrency(item.amount)}</p>
            </Link>
          ))}
          {!data.recent?.length ? <p className="text-sm text-muted">Nenhum produto baixado neste período.</p> : null}
        </div>
      </Card>
    </div>
  );
}
