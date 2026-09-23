"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api-client";
import { Button, Card, Field, PageHeader, Select, Textarea } from "@/components/ui";
import { ActionMenu } from "@/components/action-menu";
import { ConditionBadge, StatusBadge } from "@/components/badges";
import { RemoteGallery } from "@/components/images";
import { Timeline } from "@/components/timeline";
import { LocationPickers } from "@/components/location-pickers";
import { ConfirmDialog, Modal } from "@/components/modal";
import { LabelModelPicker, openLabelPrint } from "@/components/label-model-picker";
import { ProductTrashDialog } from "@/components/product-trash-dialog";
import { CLOSED_STATUSES, STATUSES, UNIT_TYPE_LABELS, canOperateStock } from "@/lib/constants";
import { formatCurrency, formatDate, formatDateTime, formatProductId } from "@/lib/format";
import { can, canAccessSaleOrderRecord, PERMISSIONS } from "@/lib/permissions";

export default function ProductDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [product, setProduct] = useState(null);
  const [me, setMe] = useState(null);
  const [locationTypes, setLocationTypes] = useState([]);
  const [locations, setLocations] = useState([]);
  const [locationForm, setLocationForm] = useState({ locationTypeId: "", locationId: "" });
  const [units, setUnits] = useState([]);
  const [toUnitId, setToUnitId] = useState("");
  const [transferNote, setTransferNote] = useState("");
  const [receiveForm, setReceiveForm] = useState({ locationTypeId: "", locationId: "" });
  const [locationOpen, setLocationOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [labelPickerOpen, setLabelPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [trashOpen, setTrashOpen] = useState(false);
  const [restoreOpen, setRestoreOpen] = useState(false);

  const load = useCallback(async () => {
    const [{ product: item }, { user }, types, locs, unitData] = await Promise.all([
      api(`/api/products/${id}`),
      api("/api/auth/me"),
      api("/api/location-types"),
      api("/api/locations"),
      api("/api/units"),
    ]);
    setProduct(item);
    setMe(user);
    setLocationTypes(types.items || []);
    setLocations(locs.items || []);
    setUnits(unitData.items || []);
    setLocationForm({
      locationTypeId: item.location?.locationTypeId || "",
      locationId: item.locationId || "",
    });
  }, [id]);

  useEffect(() => {
    void load().catch((error) => toast.error(error.message));
  }, [load]);

  if (!product || !me) return <p className="text-muted">Carregando produto...</p>;

  const canMutate = can(me.role, PERMISSIONS.STOCK_EXIT);
  const canEdit = can(me.role, PERMISSIONS.PRODUCT_EDIT);
  const canAssignLocation = can(me.role, PERMISSIONS.LOCATION_ASSIGN);
  const canPhoto = can(me.role, PERMISSIONS.PHOTO_UPLOAD);
  const canTransfer = can(me.role, PERMISSIONS.STOCK_TRANSFER);
  const canRepair = can(me.role, PERMISSIONS.REPAIR_CREATE) || can(me.role, PERMISSIONS.REPAIR_VIEW);
  const canOpenSale = can(me.role, PERMISSIONS.SALE_VIEW) && canAccessSaleOrderRecord(me, product.openSaleOrder);
  const canTrash = can(me.role, PERMISSIONS.PRODUCT_TRASH);
  const inTrash = Boolean(product.deletedAt);
  const closed = CLOSED_STATUSES.includes(product.status);
  const inActiveUnit = Number(me.activeUnitId) === Number(product.unitId);
  const incomingHere = product.status === STATUSES.IN_TRANSIT && Number(product.transferToUnitId) === Number(me.activeUnitId);
  const operable = canOperateStock(product.status) && inActiveUnit;
  const destinations = units.filter((unit) => String(unit.id) !== String(product.unitId));

  async function runTransfer(action, extra = {}) {
    setSaving(true);
    try {
      const data = await api("/api/stock/transfer", {
        method: "POST",
        json: { action, productId: product.id, ...extra },
      });
      toast.success(data.message);
      setTransferOpen(false);
      setReceiveOpen(false);
      setToUnitId("");
      setTransferNote("");
      setReceiveForm({ locationTypeId: "", locationId: "" });
      load();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  }

  async function saveLocation() {
    setSaving(true);
    try {
      const data = await api(`/api/products/${product.id}`, {
        method: "PATCH",
        json: { locationTypeId: locationForm.locationTypeId, locationId: locationForm.locationId || null },
      });
      toast.success(data.message);
      setLocationOpen(false);
      load();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  }

  async function runReserve(action) {
    try {
      const data = await api("/api/stock/reserve", { method: "POST", json: { productId: product.id, action } });
      toast.success(data.message);
      load();
    } catch (error) {
      toast.error(error.message);
    }
  }

  async function moveToTrash(observation) {
    setSaving(true);
    try {
      const data = await api("/api/products/trash", {
        method: "POST",
        json: { productIds: [product.id], observation },
      });
      toast.success(data.message);
      setTrashOpen(false);
      router.push("/lixeira");
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  }

  async function restoreFromTrash() {
    setSaving(true);
    try {
      const data = await api("/api/products/trash/restore", {
        method: "POST",
        json: { productIds: [product.id] },
      });
      toast.success(data.message);
      setRestoreOpen(false);
      load();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="w-full">
      <PageHeader
        title={formatProductId(product.id)}
        subtitle={product.commercialName || product.supplierModelCode || product.serialOnyx}
        actions={
          <>
            <ActionMenu
              items={[
                canEdit && operable && !inTrash ? { label: "Editar", onClick: () => router.push(`/estoque/${product.id}/editar`) } : null,
                { label: "Imprimir ficha", onClick: () => window.open(`/estoque/${product.id}/imprimir`, "_blank", "noopener,noreferrer") },
                { label: "Imprimir etiqueta", onClick: () => setLabelPickerOpen(true) },
                canAssignLocation && operable && !inTrash ? { label: "Localização", onClick: () => setLocationOpen(true) } : null,
                canMutate && operable && !inTrash && product.status === STATUSES.RESERVED && !["RESERVADO", "PEDIDO"].includes(product.openSaleOrder?.itemStatus)
                  ? { label: "Liberar reserva", onClick: () => runReserve("unreserve") }
                  : null,
                canTransfer && inActiveUnit && !inTrash && product.status === STATUSES.AVAILABLE ? { label: "Transferir", onClick: () => setTransferOpen(true) } : null,
                canTransfer && inActiveUnit && !inTrash && product.status === STATUSES.IN_TRANSIT ? { label: "Cancelar envio", onClick: () => runTransfer("cancel") } : null,
                canTransfer && incomingHere && !inTrash ? { label: "Receber", onClick: () => setReceiveOpen(true) } : null,
                can(me.role, PERMISSIONS.REPAIR_CREATE) && !inTrash && !product.openWorkOrder ? { label: "Abrir OS", onClick: () => router.push(`/reparos/novo?productId=${product.id}`) } : null,
                canRepair && product.openWorkOrder ? { label: `Ver OS ${product.openWorkOrder.number}`, onClick: () => router.push(`/reparos/${product.openWorkOrder.id}`) } : null,
                canOpenSale ? { label: `Ver venda ${product.openSaleOrder.number}`, onClick: () => router.push(`/vendas/${product.openSaleOrder.id}`) } : null,
                canTrash && inActiveUnit && !inTrash ? { label: "Mover para a lixeira", danger: true, onClick: () => setTrashOpen(true) } : null,
                canTrash && inActiveUnit && inTrash ? { label: "Restaurar", onClick: () => setRestoreOpen(true) } : null,
              ]}
            />
            {canMutate && operable && !closed && !inTrash && !product.openSaleOrder ? <Link href={`/saida?id=${product.id}`}><Button>Dar baixa</Button></Link> : null}
          </>
        }
      />

      {inTrash ? (
        <Card className="mb-4 border-rose-500/30 bg-rose-500/10">
          <p className="text-sm font-medium text-rose-300">Este produto está na lixeira.</p>
          <p className="mt-1 text-sm text-muted">
            Excluído em {formatDateTime(product.deletedAt)}
            {product.deletedBy?.name ? ` por ${product.deletedBy.name}` : ""}. Restaure para voltar ao estoque.
          </p>
        </Card>
      ) : null}

      <Card className="mb-4">
        <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
          <img
            src={product.primaryImage?.fileUrl || "/logo.svg"}
            alt=""
            className="h-56 w-full rounded-xl object-cover bg-surface-2 lg:h-full"
          />
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <ConditionBadge condition={product.condition} />
              <StatusBadge status={product.status} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <Info label="Unidade" value={product.unit ? `${product.unit.name} (${UNIT_TYPE_LABELS[product.unit.type] || product.unit.type})` : "—"} />
              {product.status === STATUSES.IN_TRANSIT ? (
                <Info label="Em trânsito para" value={product.transferToUnit?.name} />
              ) : null}
              <Info label="Serial Onyx" value={product.serialOnyx} />
              <Info label="Nome comercial" value={product.commercialName} />
              <Info label="Model Code" value={product.supplierModelCode} />
              <Info label="EAN" value={product.ean} />
              <Info label="Categoria" value={product.category?.name} />
              <Info label="Linha" value={product.line?.name} />
              <Info label="Capacidade / Tamanho / Tipo" value={product.capacitySizeType} />
              <Info label="Tensão" value={product.voltage} />
              <Info label="Tipo de localização" value={product.location?.locationType?.name} />
              <Info label="Localização" value={product.location?.name} />
              <Info label="Entrada" value={formatDateTime(product.entryDate)} />
              <Info label="Cadastrado por" value={product.createdBy?.name} />
              {product.openSaleOrder ? (
                <Info
                  label="Venda em andamento"
                  value={
                    canOpenSale
                      ? `${product.openSaleOrder.number}${product.openSaleOrder.reservedUntil ? ` · reserva até ${formatDate(product.openSaleOrder.reservedUntil)}` : product.openSaleOrder.itemStatus === "INTERESSE" ? " · interesse" : ""}`
                      : product.openSaleOrder.reservedUntil
                        ? `Reservado até ${formatDate(product.openSaleOrder.reservedUntil)}`
                        : "Em outra venda"
                  }
                />
              ) : null}
            </div>
            {!inActiveUnit && !incomingHere ? (
              <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">
                Este produto está em {product.unit?.name}. Troque o seletor de unidade para operar nele.
              </p>
            ) : null}
          </div>
        </div>
      </Card>

      <div className="mb-4 grid gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-xs uppercase text-muted">Preço de mercado</p>
          <p className="mt-1 text-2xl font-semibold">{formatCurrency(product.marketPrice)}</p>
        </Card>
        <Card>
          <p className="text-xs uppercase text-muted">Preço à vista</p>
          <p className="mt-1 text-2xl font-semibold text-accent">{formatCurrency(product.cashPrice)}</p>
        </Card>
        <Card>
          <p className="text-xs uppercase text-muted">Preço parcelado</p>
          <p className="mt-1 text-2xl font-semibold">{formatCurrency(product.installmentPrice)}</p>
        </Card>
      </div>
      <p className="mb-4 text-sm text-muted">
        Última atualização de preços: {formatDateTime(product.lastPriceUpdateAt)}
      </p>

      <Card className="mb-4">
        <h2 className="mb-2 font-semibold">Descrição</h2>
        <p className="text-sm text-muted">{product.description || "Sem descrição."}</p>
        {product.damageDescription ? (
          <div className="mt-4 rounded-xl border border-orange-500/30 bg-orange-500/10 p-3 text-sm">
            <p className="font-semibold text-orange-300">Avarias</p>
            <p className="mt-1">{product.damageDescription}</p>
          </div>
        ) : null}
      </Card>

      <Card className="mb-4 w-full overflow-hidden p-0">
        <div className="border-b border-border px-5 py-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Histórico</p>
          <p className="mt-1 text-sm text-muted">Movimentações do produto nesta unidade e nas transferências.</p>
        </div>
        <div className="px-5 py-4">
          <Timeline items={product.movements} />
        </div>
      </Card>

      <Card className="w-full">
        <h2 className="mb-3 font-semibold">Galeria</h2>
        <RemoteGallery
          product={product}
          canEdit={canPhoto && operable && !inTrash}
          onChanged={async () => {
            toast.success("Imagem atualizada.");
            load();
          }}
        />
        {canPhoto && operable && !inTrash ? (
          <div className="mt-4">
            <p className="mb-2 text-sm text-muted">Documentos / anexos</p>
            <input
              type="file"
              accept=".pdf,.doc,.docx,image/*"
              onChange={async (event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                const form = new FormData();
                form.append("file", file);
                try {
                  await api(`/api/products/${product.id}/files`, { method: "POST", body: form });
                  toast.success("Anexo adicionado.");
                  load();
                } catch (error) {
                  toast.error(error.message);
                }
              }}
            />
            <ul className="mt-2 space-y-1 text-sm">
              {product.files?.map((file) => (
                <li key={file.id}>
                  <a className="text-accent" href={file.fileUrl} target="_blank" rel="noreferrer">{file.fileName}</a>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </Card>

      <Modal
        open={locationOpen}
        title="Alterar localização"
        onClose={() => !saving && setLocationOpen(false)}
        footer={
          <>
            <Button type="button" variant="secondary" onClick={() => setLocationOpen(false)} disabled={saving}>Cancelar</Button>
            <Button type="button" onClick={saveLocation} disabled={saving}>{saving ? "Salvando..." : "Salvar localização"}</Button>
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <LocationPickers
            typeId={locationForm.locationTypeId}
            locationId={locationForm.locationId}
            types={locationTypes}
            locations={locations}
            onChange={setLocationForm}
          />
        </div>
      </Modal>

      <Modal
        open={transferOpen}
        title="Transferir para outra unidade"
        onClose={() => !saving && setTransferOpen(false)}
        footer={
          <>
            <Button type="button" variant="secondary" onClick={() => setTransferOpen(false)} disabled={saving}>Cancelar</Button>
            <Button
              type="button"
              disabled={!toUnitId || saving}
              onClick={() => runTransfer("send", { toUnitId: Number(toUnitId), observation: transferNote })}
            >
              {saving ? "Enviando..." : "Enviar"}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Field label="Destino">
            <Select value={toUnitId} onChange={(e) => setToUnitId(e.target.value)}>
              <option value="">Selecione o destino</option>
              {destinations.map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {unit.name} ({UNIT_TYPE_LABELS[unit.type] || unit.type})
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Observação">
            <Textarea value={transferNote} onChange={(e) => setTransferNote(e.target.value)} placeholder="Observação (opcional)" />
          </Field>
        </div>
      </Modal>

      <Modal
        open={receiveOpen}
        title="Confirmar recebimento"
        onClose={() => !saving && setReceiveOpen(false)}
        className="max-w-xl"
        footer={
          <>
            <Button type="button" variant="secondary" onClick={() => runTransfer("refuse")} disabled={saving}>Recusar</Button>
            <Button type="button" onClick={() => runTransfer("receive", receiveForm)} disabled={saving || !receiveForm.locationId}>
              {saving ? "Recebendo..." : "Receber nesta unidade"}
            </Button>
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <LocationPickers
            typeId={receiveForm.locationTypeId}
            locationId={receiveForm.locationId}
            types={locationTypes}
            locations={locations}
            onChange={setReceiveForm}
          />
        </div>
      </Modal>

      <LabelModelPicker
        open={labelPickerOpen}
        onClose={() => setLabelPickerOpen(false)}
        onSelect={(model) => {
          openLabelPrint({ productIds: [product.id], model });
          setLabelPickerOpen(false);
        }}
      />
      <ProductTrashDialog
        open={trashOpen}
        loading={saving}
        onConfirm={moveToTrash}
        onClose={() => !saving && setTrashOpen(false)}
      />
      <ConfirmDialog
        open={restoreOpen}
        title="Restaurar produto"
        message="O aparelho volta ao estoque no mesmo status de quando foi para a lixeira."
        confirmLabel="Restaurar"
        loading={saving}
        onConfirm={restoreFromTrash}
        onClose={() => !saving && setRestoreOpen(false)}
      />
    </div>
  );
}

function Info({ label, value }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 text-sm font-medium">{value || "—"}</p>
    </div>
  );
}
