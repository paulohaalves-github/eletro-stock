"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { Card, PageHeader } from "@/components/ui";
import { formatDateTime } from "@/lib/format";

export default function AuditoriaPage() {
  const [data, setData] = useState({ items: [] });

  useEffect(() => {
    api("/api/audit").then(setData).catch(() => setData({ items: [] }));
  }, []);

  return (
    <div>
      <PageHeader title="Auditoria" subtitle="Registro imutável para operadores comuns. Alterações relevantes ficam aqui." />
      <div className="space-y-3">
        {data.items.map((item) => (
          <Card key={item.id}>
            <p className="text-sm font-medium">{item.action} · {item.entity} #{item.entityId}</p>
            <p className="text-xs text-muted">{formatDateTime(item.createdAt)} · {item.user?.name}</p>
            {item.oldData || item.newData ? (
              <pre className="mt-2 overflow-x-auto rounded-lg bg-bg p-3 text-[11px] text-muted">
                {JSON.stringify({ anterior: item.oldData, novo: item.newData }, null, 2)}
              </pre>
            ) : null}
          </Card>
        ))}
      </div>
    </div>
  );
}
