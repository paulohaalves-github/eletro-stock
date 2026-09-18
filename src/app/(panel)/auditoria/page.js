"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { Card, Input, PageHeader } from "@/components/ui";
import { LoadMore, SearchActions } from "@/components/paged-list";
import { formatDateTime } from "@/lib/format";
import { listQuery } from "@/lib/pagination";
import { usePagedList } from "@/hooks/use-paged-list";

export default function AuditoriaPage() {
  const list = usePagedList();
  const [q, setQ] = useState("");

  function loader(page, pageSize) {
    return api(`/api/audit?${listQuery({ q }, page, pageSize)}`);
  }

  useEffect(() => {
    void list.search(loader);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="w-full">
      <PageHeader title="Auditoria" subtitle="Registro imutável para operadores comuns. Alterações relevantes ficam aqui." />
      <Card className="mb-4 space-y-3">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ação, entidade ou usuário" />
        <SearchActions
          loading={list.loading}
          onSearch={() => void list.search(loader)}
          onClear={() => {
            setQ("");
            void list.search((page, pageSize) => api(`/api/audit?${listQuery({ q: "" }, page, pageSize)}`));
          }}
        />
      </Card>
      <Card className="w-full overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-5 py-3 font-semibold">Quando</th>
                <th className="px-5 py-3 font-semibold">Ação</th>
                <th className="px-5 py-3 font-semibold">Entidade</th>
                <th className="px-5 py-3 font-semibold">Usuário</th>
                <th className="px-5 py-3 font-semibold">Dados</th>
              </tr>
            </thead>
            <tbody>
              {list.items.map((item) => (
                <tr key={item.id} className="border-t border-border align-top hover:bg-surface-2/80">
                  <td className="px-5 py-4 font-medium">{formatDateTime(item.createdAt)}</td>
                  <td className="px-5 py-4">{item.action}</td>
                  <td className="px-5 py-4 text-muted">{item.entity} #{item.entityId}</td>
                  <td className="px-5 py-4 text-muted">{item.user?.name}</td>
                  <td className="px-5 py-4">
                    {item.oldData || item.newData ? (
                      <pre className="overflow-x-auto rounded-lg bg-bg p-3 text-[11px] text-muted">
                        {JSON.stringify({ anterior: item.oldData, novo: item.newData }, null, 2)}
                      </pre>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!list.items.length ? <p className="px-5 py-6 text-sm text-muted">Nenhum registro de auditoria.</p> : null}
      </Card>
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
