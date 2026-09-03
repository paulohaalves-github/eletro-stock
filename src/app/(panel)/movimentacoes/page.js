"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api-client";
import { Card, Input, PageHeader, Select } from "@/components/ui";
import { StatusBadge } from "@/components/badges";
import { MOVEMENT_TYPE_LABELS, STATUS_LABELS } from "@/lib/constants";
import { formatDateTime, formatLocationPath, formatProductId } from "@/lib/format";

export default function MovimentacoesPage() {
  const [q, setQ] = useState("");
  const [type, setType] = useState("");
  const [data, setData] = useState({ items: [], total: 0 });

  useEffect(() => {
    const timeout = setTimeout(() => {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (type) params.set("type", type);
      api(`/api/movements?${params}`).then(setData);
    }, 180);
    return () => clearTimeout(timeout);
  }, [q, type]);

  return (
    <div>
      <PageHeader title="Movimentações" subtitle="Timeline geral de entradas, saídas e alterações." />
      <Card className="mb-4 grid gap-2 sm:grid-cols-2">
        <Input placeholder="Buscar produto, serial, observação..." value={q} onChange={(e) => setQ(e.target.value)} />
        <Select value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">Todos os tipos</option>
          {Object.entries(MOVEMENT_TYPE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </Select>
      </Card>
      <div className="space-y-3">
        {data.items.map((item) => (
          <Link key={item.id} href={`/estoque/${item.productId}`} className="card flex items-start gap-3 p-4 hover:border-accent/40">
            <img src={item.product?.images?.[0]?.fileUrl || "/logo.svg"} alt="" className="h-12 w-12 rounded-lg object-cover" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{MOVEMENT_TYPE_LABELS[item.type] || item.type}</p>
              <p className="text-xs text-muted">
                {formatDateTime(item.createdAt)} · {item.user?.name} · {formatProductId(item.productId)}
              </p>
              <p className="mt-1 text-xs text-muted">
                {item.type === "ALTERACAO_LOCALIZACAO"
                  ? `${formatLocationPath(item.previousLocation) || "sem localização"} → ${formatLocationPath(item.newLocation) || "sem localização"}`
                  : `${STATUS_LABELS[item.previousStatus] || item.previousStatus || "—"} → ${STATUS_LABELS[item.newStatus] || item.newStatus || "—"}`}
              </p>
              {item.observation && item.type !== "ALTERACAO_LOCALIZACAO" ? <p className="mt-1 text-sm">{item.observation}</p> : null}
            </div>
            {item.product ? <StatusBadge status={item.product.status} /> : null}
          </Link>
        ))}
      </div>
    </div>
  );
}
