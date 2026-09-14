"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { api, uploadWithProgress } from "@/lib/api-client";
import { Button, Card, Field, PageHeader, Select, Textarea } from "@/components/ui";
import { LocationPickers } from "@/components/location-pickers";
import { ImagePicker } from "@/components/images";
import { PartRequestBadge, StatusBadge, WorkOrderStatusBadge } from "@/components/badges";
import { ConfirmDialog, Modal } from "@/components/modal";
import { WorkOrderTimeline } from "@/components/work-order-timeline";
import {
  SERVICE_PLACE_LABELS,
  SERVICE_PLACES,
  WORK_ORDER_INTERACTION_TYPES,
  WORK_ORDER_EVENT_LABELS,
  WORK_ORDER_STATUSES,
  WORK_ORDER_STATUS_LABELS,
} from "@/lib/constants";
import { formatDate, formatLocationPath, formatProductId } from "@/lib/format";
import { can, PERMISSIONS } from "@/lib/permissions";

const emptyInteraction = {
  type: WORK_ORDER_INTERACTION_TYPES.TECHNICIAN_NOTE,
  message: "",
  files: [],
  partId: "",
  partQty: "1",
};

export default function WorkOrderDetailPage() {
  const { id } = useParams();
  const [order, setOrder] = useState(null);
  const [me, setMe] = useState(null);
  const [interactionOpen, setInteractionOpen] = useState(false);
  const [interactionType, setInteractionType] = useState(emptyInteraction.type);
  const [interactionMessage, setInteractionMessage] = useState(emptyInteraction.message);
  const [interactionFiles, setInteractionFiles] = useState(emptyInteraction.files);
  const [status, setStatus] = useState("");
  const [parts, setParts] = useState([]);
  const [partId, setPartId] = useState(emptyInteraction.partId);
  const [partQty, setPartQty] = useState(emptyInteraction.partQty);
  const [locationTypes, setLocationTypes] = useState([]);
  const [locations, setLocations] = useState([]);
  const [locationForm, setLocationForm] = useState({ locationTypeId: "", locationId: "" });
  const [deliverOpen, setDeliverOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const [{ workOrder }, { user }, partData, types, locs] = await Promise.all([
      api(`/api/work-orders/${id}`),
      api("/api/auth/me"),
      api("/api/parts?active=true&pageSize=100"),
      api("/api/location-types"),
      api("/api/locations"),
    ]);
    setOrder(workOrder);
    setMe(user);
    setStatus(workOrder.status);
    setParts(partData.items || []);
    setLocationTypes(types.items || []);
    setLocations(locs.items || []);
    setLocationForm({
      locationTypeId: workOrder.product?.location?.locationTypeId || "",
      locationId: workOrder.product?.locationId || "",
    });
  }, [id]);

  useEffect(() => {
    void load().catch((error) => toast.error(error.message));
  }, [load]);

  if (!order || !me) return <p className="text-muted">Carregando ordem de serviço...</p>;

  const canUpdate = can(me.role, PERMISSIONS.REPAIR_UPDATE) && !order.closed;
  const atLab = order.servicePlace === SERVICE_PLACES.LAB && Number(me.activeUnitId) === Number(order.labUnitId);
  const sale = order.sale;
  const hasNotes = Boolean(interactionMessage.trim() || interactionFiles.length || status !== order.status);
  const hasPart = Boolean(partId);
  const canSubmit = hasNotes || hasPart;

  function resetInteraction() {
    setInteractionType(emptyInteraction.type);
    setInteractionMessage(emptyInteraction.message);
    setInteractionFiles(emptyInteraction.files);
    setPartId(emptyInteraction.partId);
    setPartQty(emptyInteraction.partQty);
    setStatus(order.status);
  }

  function openInteraction() {
    resetInteraction();
    setInteractionOpen(true);
  }

  function closeInteraction() {
    if (saving) return;
    setInteractionOpen(false);
    resetInteraction();
  }

  async function submitInteraction(event) {
    event.preventDefault();
    if (!canSubmit) return;
    setSaving(true);
    try {
      if (hasNotes) {
        const form = new FormData();
        form.append("type", interactionType);
        form.append("message", interactionMessage);
        if (status && status !== order.status) form.append("status", status);
        interactionFiles.forEach((file) => form.append("files", file));
        await uploadWithProgress(`/api/work-orders/${order.id}/events`, form);
      }
      if (hasPart) {
        await api(`/api/work-orders/${order.id}/parts`, {
          method: "POST",
          json: { partId: Number(partId), quantity: Number(partQty) },
        });
      }
      toast.success("Interação registrada.");
      setInteractionOpen(false);
      resetInteraction();
      load();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  }

  async function saveLocation() {
    try {
      const data = await api(`/api/work-orders/${order.id}/location`, {
        method: "POST",
        json: { locationId: Number(locationForm.locationId) },
      });
      toast.success(data.message);
      load();
    } catch (error) {
      toast.error(error.message);
    }
  }

  async function deliver() {
    setLoading(true);
    try {
      const data = await api(`/api/work-orders/${order.id}/deliver`, { method: "POST", json: {} });
      toast.success(data.message);
      setDeliverOpen(false);
      load();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full">
      <PageHeader
        title={order.number}
        subtitle={`${order.commercialName || order.product?.serialOnyx} · ${SERVICE_PLACE_LABELS[order.servicePlace]}`}
        actions={
          <>
            <Link href={`/estoque/${order.productId}`}><Button variant="secondary">Ver produto</Button></Link>
            {canUpdate && (order.status === WORK_ORDER_STATUSES.READY || order.status === WORK_ORDER_STATUSES.REPAIRING) ? (
              <Button variant="secondary" onClick={() => setDeliverOpen(true)}>Devolver ao cliente</Button>
            ) : null}
            {canUpdate ? <Button onClick={openInteraction}>Nova interação</Button> : null}
          </>
        }
      />

      <Card className="mb-4 space-y-4">
        <div className="flex flex-wrap gap-2">
          <WorkOrderStatusBadge status={order.status} />
          <StatusBadge status={order.product?.status} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Info label="Cliente" value={`${order.customer?.name} · ${order.customer?.phone}`} />
          <Info label="Produto" value={`${formatProductId(order.productId)} · ${order.product?.serialOnyx}`} />
          <Info label="NF / garantia" value={`${sale?.invoiceNumber || "—"} · ${sale?.warrantyMonths || "—"} meses · venda em ${formatDate(sale?.soldAt)}`} />
          <Info label="Unidade" value={order.labUnit ? `${order.unit?.name} → ${order.labUnit.name}` : order.unit?.name} />
          <Info label="Defeito relatado" value={order.reportedDefect} className="sm:col-span-2 xl:col-span-2" />
          {order.customer?.address ? <Info label="Endereço" value={order.customer.address} /> : null}
          {order.product?.location ? <Info label="Localização atual" value={formatLocationPath(order.product.location)} /> : null}
        </div>
        {canUpdate && atLab ? (
          <div className="grid gap-3 border-t border-border pt-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <LocationPickers
              typeId={locationForm.locationTypeId}
              locationId={locationForm.locationId}
              types={locationTypes}
              locations={locations}
              onChange={setLocationForm}
              required
            />
            <Button type="button" variant="secondary" disabled={!locationForm.locationId} onClick={saveLocation}>
              Posicionar aparelho
            </Button>
          </div>
        ) : null}
        {order.parts?.length ? (
          <div className="border-t border-border pt-4">
            <p className="mb-3 text-xs uppercase tracking-wide text-muted">Peças da OS</p>
            <div className="flex flex-wrap gap-2">
              {order.parts.map((item) => (
                <div key={item.id} className="flex items-center gap-3 rounded-xl border border-border px-3 py-2">
                  <div>
                    <p className="text-sm font-medium">{item.part?.code} · {item.part?.name}</p>
                    <p className="text-xs text-muted">Qtd {item.quantity}</p>
                  </div>
                  <PartRequestBadge status={item.status} />
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </Card>

      <Card className="w-full overflow-hidden p-0">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Linha do tempo</p>
            <p className="mt-1 text-sm text-muted">
              Cada interação aparece individualmente, com as informações e as evidências daquele momento.
            </p>
          </div>
          {canUpdate ? <Button onClick={openInteraction}>Nova interação</Button> : null}
        </div>
        <WorkOrderTimeline events={order.events || []} />
      </Card>

      <Modal
        open={interactionOpen}
        title="Nova interação"
        onClose={closeInteraction}
        className="max-w-2xl"
        footer={
          <>
            <Button type="button" variant="secondary" onClick={closeInteraction} disabled={saving}>
              Cancelar
            </Button>
            <Button type="submit" form="work-order-interaction" disabled={saving || !canSubmit}>
              {saving ? "Registrando..." : "Registrar interação"}
            </Button>
          </>
        }
      >
        <form id="work-order-interaction" onSubmit={submitInteraction} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Tipo">
              <Select value={interactionType} onChange={(e) => setInteractionType(e.target.value)}>
                {Object.values(WORK_ORDER_INTERACTION_TYPES).map((value) => (
                  <option key={value} value={value}>{WORK_ORDER_EVENT_LABELS[value]}</option>
                ))}
              </Select>
            </Field>
            <Field label="Status da OS">
              <Select value={status} onChange={(e) => setStatus(e.target.value)}>
                {Object.entries(WORK_ORDER_STATUS_LABELS)
                  .filter(([value]) => value !== "ENTREGUE")
                  .map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
              </Select>
            </Field>
          </div>
          <Field label="Informações">
            <Textarea
              value={interactionMessage}
              onChange={(e) => setInteractionMessage(e.target.value)}
              placeholder="O que foi feito, encontrado ou combinado nesta interação"
            />
          </Field>
          <Field label="Evidências">
            <ImagePicker files={interactionFiles} onChange={setInteractionFiles} />
          </Field>
          <div className="space-y-3 border-t border-border pt-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Solicitar peça</p>
            <div className="grid gap-3 sm:grid-cols-[1fr_120px]">
              <Field label="Peça" hint="Opcional. A solicitação também entra na linha do tempo.">
                <Select value={partId} onChange={(e) => setPartId(e.target.value)}>
                  <option value="">Nenhuma peça nesta interação</option>
                  {parts.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.code} · {item.name} ({item.quantityInUnit || 0} nesta unidade)
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Qtd">
                <input
                  type="number"
                  min="1"
                  value={partQty}
                  onChange={(e) => setPartQty(e.target.value)}
                  disabled={!partId}
                  className="w-full rounded-xl border border-border bg-bg px-3.5 py-2.5 text-sm outline-none focus:border-accent disabled:opacity-50"
                />
              </Field>
            </div>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={deliverOpen}
        title="Devolver ao cliente"
        message="O aparelho voltará ao status vendido e a ordem será encerrada."
        confirmLabel="Confirmar entrega"
        loading={loading}
        onClose={() => setDeliverOpen(false)}
        onConfirm={deliver}
      />
    </div>
  );
}

function Info({ label, value, className }) {
  return (
    <div className={className}>
      <p className="text-[11px] uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 text-sm font-medium">{value || "—"}</p>
    </div>
  );
}
