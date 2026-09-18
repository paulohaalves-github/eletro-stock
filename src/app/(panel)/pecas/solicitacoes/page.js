"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api-client";
import { Button, Card, Input, PageHeader, Select } from "@/components/ui";
import { LoadMore, SearchActions } from "@/components/paged-list";
import { LocationPickers } from "@/components/location-pickers";
import { PartRequestBadge } from "@/components/badges";
import { Modal } from "@/components/modal";
import { formatDateTime, formatProductId } from "@/lib/format";
import { listQuery } from "@/lib/pagination";
import { usePagedList } from "@/hooks/use-paged-list";
import { can, PERMISSIONS } from "@/lib/permissions";
import { WORK_ORDER_PART_STATUS_LABELS, WORK_ORDER_PART_STATUSES } from "@/lib/constants";

export default function SolicitacoesPecasPage() {
  const list = usePagedList();
  const [me, setMe] = useState(null);
  const [types, setTypes] = useState([]);
  const [locations, setLocations] = useState([]);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState(WORK_ORDER_PART_STATUSES.REQUESTED);
  const [activeItem, setActiveItem] = useState(null);
  const [form, setForm] = useState({ locationTypeId: "", locationId: "" });
  const [saving, setSaving] = useState(false);

  function loader(page, pageSize) {
    return api(`/api/parts/requests?${listQuery({ q, status }, page, pageSize)}`);
  }

  async function loadMeta() {
    const [auth, locTypes, locs] = await Promise.all([
      api("/api/auth/me"),
      api("/api/location-types"),
      api("/api/locations"),
    ]);
    setMe(auth.user);
    setTypes(locTypes.items || []);
    setLocations(locs.items || []);
  }

  useEffect(() => {
    void loadMeta().catch((error) => toast.error(error.message));
    void list.search(loader);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const canStock = me && can(me.role, PERMISSIONS.PART_STOCK);

  function openFulfill(item) {
    setActiveItem(item);
    setForm({ locationTypeId: "", locationId: "" });
  }

  function closeFulfill() {
    if (saving) return;
    setActiveItem(null);
    setForm({ locationTypeId: "", locationId: "" });
  }

  async function fulfill() {
    if (!activeItem) return;
    setSaving(true);
    try {
      const data = await api(`/api/parts/requests/${activeItem.id}`, {
        method: "POST",
        json: { action: "fulfill", locationId: Number(form.locationId) },
      });
      toast.success(data.message);
      closeFulfill();
      void list.search(loader);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  }

  async function refuse(item) {
    const reason = window.prompt("Motivo da recusa:");
    if (!reason) return;
    try {
      const data = await api(`/api/parts/requests/${item.id}`, {
        method: "POST",
        json: { action: "refuse", observation: reason },
      });
      toast.success(data.message);
      void list.search(loader);
    } catch (error) {
      toast.error(error.message);
    }
  }

  return (
    <div className="w-full">
      <PageHeader title="Solicitações de peça" subtitle="O estoque atende os pedidos das ordens de serviço, baixando o saldo da localização." />

      <Card className="mb-4 space-y-3">
        <div className="grid gap-2 sm:grid-cols-2">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Peça, OS ou cliente" />
          <Select value={status} onChange={(e) => setStatus(e.target.value)}>
            {Object.entries(WORK_ORDER_PART_STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </Select>
        </div>
        <SearchActions
          loading={list.loading}
          onSearch={() => void list.search(loader)}
          onClear={() => {
            setQ("");
            setStatus(WORK_ORDER_PART_STATUSES.REQUESTED);
            void list.search((page, pageSize) => api(`/api/parts/requests?${listQuery({ q: "", status: WORK_ORDER_PART_STATUSES.REQUESTED }, page, pageSize)}`));
          }}
        />
      </Card>
      <Card className="w-full overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-5 py-3 font-semibold">Peça</th>
                <th className="px-5 py-3 font-semibold">OS / Cliente</th>
                <th className="px-5 py-3 font-semibold">Quando</th>
                <th className="px-5 py-3 font-semibold">Status</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {list.items.map((item) => (
                <tr key={item.id} className="border-t border-border align-top hover:bg-surface-2/80">
                  <td className="px-5 py-4">
                    <p className="font-medium">{item.part?.code} · {item.part?.name}</p>
                    <p className="text-xs text-muted">Qtd {item.quantity}</p>
                  </td>
                  <td className="px-5 py-4">
                    <Link className="text-accent" href={`/reparos/${item.workOrderId}`}>{item.workOrder?.number}</Link>
                    <p className="text-sm text-muted">{item.workOrder?.customer?.name}</p>
                    <p className="text-xs text-muted">{formatProductId(item.workOrder?.productId)}</p>
                  </td>
                  <td className="px-5 py-4 text-muted">
                    <p>{formatDateTime(item.createdAt)}</p>
                    <p className="text-xs">{item.requestedBy?.name}</p>
                  </td>
                  <td className="px-5 py-4"><PartRequestBadge status={item.status} /></td>
                  <td className="px-5 py-4 text-right">
                    {canStock ? (
                      <div className="flex flex-wrap justify-end gap-2">
                        <Button onClick={() => openFulfill(item)}>Atender</Button>
                        <Button variant="ghost" onClick={() => refuse(item)}>Recusar</Button>
                      </div>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!list.items.length ? <p className="px-5 py-6 text-sm text-muted">Nenhuma solicitação pendente.</p> : null}
      </Card>
      <LoadMore
        shown={list.items.length}
        total={list.total}
        hasMore={list.hasMore}
        loading={list.loadingMore}
        onClick={() => void list.loadMore()}
      />

      <Modal
        open={Boolean(activeItem)}
        title="Atender solicitação"
        onClose={closeFulfill}
        className="max-w-xl"
        footer={
          <>
            <Button type="button" variant="secondary" onClick={closeFulfill} disabled={saving}>Cancelar</Button>
            <Button type="button" onClick={fulfill} disabled={saving || !form.locationId}>
              {saving ? "Atendendo..." : "Confirmar baixa"}
            </Button>
          </>
        }
      >
        {activeItem ? (
          <div className="space-y-4">
            <p className="text-sm">
              {activeItem.part?.code} · {activeItem.part?.name} · qtd {activeItem.quantity}
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <LocationPickers
                typeId={form.locationTypeId}
                locationId={form.locationId}
                types={types}
                locations={locations}
                onChange={setForm}
                required
              />
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
