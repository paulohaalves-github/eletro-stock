"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api-client";
import { Button, Card, Input, PageHeader } from "@/components/ui";
import { ActionMenu } from "@/components/action-menu";
import { ConditionBadge, StatusBadge } from "@/components/badges";
import { ConfirmDialog } from "@/components/modal";
import { LoadMore, SearchActions } from "@/components/paged-list";
import { formatCurrency, formatDateTime, formatProductId } from "@/lib/format";
import { listQuery } from "@/lib/pagination";
import { usePagedList } from "@/hooks/use-paged-list";

export default function LixeiraPage() {
  const list = usePagedList();
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState(() => new Set());
  const [restoring, setRestoring] = useState(false);
  const [confirmIds, setConfirmIds] = useState(null);

  function loader(page, pageSize) {
    return api(`/api/products/trash?${listQuery({ q }, page, pageSize)}`);
  }

  useEffect(() => {
    void list.search(loader).then(() => setSelected(new Set()));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const allVisibleSelected = list.items.length > 0 && list.items.every((item) => selected.has(item.id));

  function toggleSelected(id, checked) {
    setSelected((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function toggleVisible(checked) {
    setSelected((current) => {
      const next = new Set(current);
      list.items.forEach((item) => {
        if (checked) next.add(item.id);
        else next.delete(item.id);
      });
      return next;
    });
  }

  async function restore(ids) {
    setRestoring(true);
    try {
      const data = await api("/api/products/trash/restore", { method: "POST", json: { productIds: ids } });
      toast.success(data.message);
      setConfirmIds(null);
      setSelected(new Set());
      await list.search(loader);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setRestoring(false);
    }
  }

  return (
    <div className="w-full">
      <PageHeader
        title="Lixeira"
        subtitle={list.total ? `${list.total} aparelho(s) nesta unidade` : "Produtos excluídos desta unidade. Dá para restaurar."}
        actions={
          <ActionMenu
            items={[
              {
                label: `Restaurar selecionados${selected.size ? ` (${selected.size})` : ""}`,
                disabled: !selected.size || restoring,
                onClick: () => setConfirmIds([...selected]),
              },
            ]}
          />
        }
      />
      <Card className="mb-4 space-y-3">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ID, Serial Onyx, nome comercial..." />
        <SearchActions
          loading={list.loading}
          onSearch={() => void list.search(loader).then(() => setSelected(new Set()))}
          onClear={() => {
            setQ("");
            void list.search((page, pageSize) => api(`/api/products/trash?${listQuery({ q: "" }, page, pageSize)}`)).then(() => setSelected(new Set()));
          }}
        />
      </Card>
      <Card className="w-full overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-5 py-3">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={(event) => toggleVisible(event.target.checked)}
                    aria-label="Selecionar visíveis"
                  />
                </th>
                <th className="px-5 py-3 font-semibold">Produto</th>
                <th className="px-5 py-3 font-semibold">Status</th>
                <th className="px-5 py-3 font-semibold">À vista</th>
                <th className="px-5 py-3 font-semibold">Excluído em</th>
                <th className="px-5 py-3 font-semibold">Por</th>
                <th className="px-5 py-3 font-semibold">Ações</th>
              </tr>
            </thead>
            <tbody>
              {list.items.map((item) => (
                <tr key={item.id} className="border-t border-border hover:bg-surface-2/80">
                  <td className="px-5 py-4">
                    <input
                      type="checkbox"
                      checked={selected.has(item.id)}
                      onChange={(event) => toggleSelected(item.id, event.target.checked)}
                      aria-label={`Selecionar ${formatProductId(item.id)}`}
                    />
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <img
                        src={item.primaryImage?.fileUrl || "/logo.svg"}
                        alt=""
                        className="h-10 w-10 rounded-lg object-cover bg-surface-2"
                      />
                      <div>
                        <p className="font-medium">{formatProductId(item.id)} · {item.commercialName || item.supplierModelCode || item.serialOnyx}</p>
                        <p className="text-xs text-muted">{item.serialOnyx || "s/ serial"}</p>
                        <div className="mt-1"><ConditionBadge condition={item.condition} /></div>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4"><StatusBadge status={item.status} /></td>
                  <td className="px-5 py-4">{formatCurrency(item.cashPrice)}</td>
                  <td className="px-5 py-4 text-muted">{formatDateTime(item.deletedAt)}</td>
                  <td className="px-5 py-4 text-muted">{item.deletedBy?.name || "—"}</td>
                  <td className="px-5 py-4">
                    <Button variant="secondary" onClick={() => setConfirmIds([item.id])} disabled={restoring}>
                      Restaurar
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!list.items.length ? <p className="px-5 py-6 text-sm text-muted">Nenhum produto na lixeira desta unidade.</p> : null}
      </Card>
      <LoadMore
        shown={list.items.length}
        total={list.total}
        hasMore={list.hasMore}
        loading={list.loadingMore}
        onClick={() => void list.loadMore()}
      />
      <ConfirmDialog
        open={Boolean(confirmIds?.length)}
        title={confirmIds?.length > 1 ? `Restaurar ${confirmIds.length} produtos` : "Restaurar produto"}
        message="O aparelho volta ao estoque no mesmo status de quando foi para a lixeira."
        confirmLabel="Restaurar"
        loading={restoring}
        onConfirm={() => restore(confirmIds)}
        onClose={() => !restoring && setConfirmIds(null)}
      />
    </div>
  );
}
