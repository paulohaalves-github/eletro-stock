"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { api } from "@/lib/api-client";
import { Card, PageHeader, Select } from "@/components/ui";
import { formatCurrency, formatDateTime, formatProductId } from "@/lib/format";
import { StatusBadge } from "@/components/badges";

const Charts = dynamic(() => import("@/components/dashboard-charts"), { ssr: false });

export default function DashboardPage() {
  const [period, setPeriod] = useState("30d");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [data, setData] = useState(null);

  useEffect(() => {
    const query = new URLSearchParams({ period });
    if (period === "custom" && from && to) {
      query.set("from", from);
      query.set("to", to);
    }
    api(`/api/dashboard?${query}`).then(setData).catch(() => setData(null));
  }, [period, from, to]);

  if (!data) {
    return <p className="text-muted">Carregando dashboard...</p>;
  }

  const cards = [
    ["Disponíveis", data.cards.available],
    ["Reservados", data.cards.reserved],
    ["Vendidos", data.cards.sold],
    ["Em estoque", data.cards.inStock],
    ["Valor à vista", formatCurrency(data.cards.cash)],
    ["Valor parcelado", formatCurrency(data.cards.installment)],
    ["Valor de mercado", formatCurrency(data.cards.market)],
    ["Margem potencial", formatCurrency(data.cards.margin)],
  ];

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle="Visão imediata do estoque individual do Outlet Eletromall."
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
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(([label, value]) => (
          <Card key={label} className="p-4">
            <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
            <p className="mt-2 text-2xl font-semibold">{value}</p>
          </Card>
        ))}
      </div>

      <Charts categoryChart={data.categoryChart} conditionChart={data.conditionChart} movementChart={data.movementChart} />

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 font-semibold">Faixas de preço (à vista)</h2>
          <div className="space-y-2">
            {data.priceBands.map((band) => (
              <div key={band.id} className="flex items-center justify-between text-sm">
                <span className="text-muted">{band.label}</span>
                <span className="font-medium">{band.count}</span>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <h2 className="mb-3 font-semibold">Diferença mercado × à vista</h2>
          <p className="text-3xl font-semibold text-accent">{formatCurrency(data.cards.margin)}</p>
          <p className="mt-1 text-sm text-muted">Potencial de margem sobre os itens em estoque.</p>
        </Card>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Recent title="Entradas recentes" items={data.recentEntries} />
        <Recent title="Saídas recentes" items={data.recentExits} />
      </div>
    </div>
  );
}

function Recent({ title, items }) {
  return (
    <Card>
      <h2 className="mb-3 font-semibold">{title}</h2>
      <div className="space-y-3">
        {items.map((item) => (
          <Link key={item.id} href={`/estoque/${item.productId}`} className="flex items-center gap-3 rounded-xl p-2 hover:bg-surface-2">
            <img src={item.product?.images?.[0]?.fileUrl || "/logo.svg"} alt="" className="h-11 w-11 rounded-lg object-cover" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">
                {formatProductId(item.productId)} · {item.product?.supplierModelCode}
              </p>
              <p className="text-xs text-muted">{formatDateTime(item.createdAt)} · {item.user?.name}</p>
            </div>
            {item.product ? <StatusBadge status={item.product.status} /> : null}
          </Link>
        ))}
      </div>
    </Card>
  );
}
