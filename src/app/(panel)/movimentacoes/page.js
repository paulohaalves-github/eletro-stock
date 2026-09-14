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
    <div className="w-full">
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

      <Card className="w-full overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-5 py-3 font-semibold">Quando</th>
                <th className="px-5 py-3 font-semibold">Movimentação</th>
                <th className="px-5 py-3 font-semibold">Produto</th>
                <th className="px-5 py-3 font-semibold">Detalhe</th>
                <th className="px-5 py-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((item) => (
                <tr key={item.id} className="border-t border-border align-top hover:bg-surface-2/80">
                  <td className="px-5 py-4">
                    <p className="font-medium">{formatDateTime(item.createdAt)}</p>
                    <p className="text-xs text-muted">{item.user?.name}</p>
                  </td>
                  <td className="px-5 py-4 font-medium">{MOVEMENT_TYPE_LABELS[item.type] || item.type}</td>
                  <td className="px-5 py-4">
                    <Link href={`/estoque/${item.productId}`} className="text-accent">
                      {formatProductId(item.productId)}
                    </Link>
                  </td>
                  <td className="px-5 py-4 text-muted">
                    <p>
                      {item.type === "ALTERACAO_LOCALIZACAO"
                        ? `${formatLocationPath(item.previousLocation) || "sem localização"} → ${formatLocationPath(item.newLocation) || "sem localização"}`
                        : `${STATUS_LABELS[item.previousStatus] || item.previousStatus || "—"} → ${STATUS_LABELS[item.newStatus] || item.newStatus || "—"}`}
                    </p>
                    {item.observation && item.type !== "ALTERACAO_LOCALIZACAO" ? (
                      <p className="mt-1 text-sm text-text">{item.observation}</p>
                    ) : null}
                  </td>
                  <td className="px-5 py-4">
                    {item.product ? <StatusBadge status={item.product.status} /> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!data.items.length ? <p className="px-5 py-6 text-sm text-muted">Nenhuma movimentação encontrada.</p> : null}
      </Card>
    </div>
  );
}
