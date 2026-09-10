"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api-client";
import { Button, Card, PageHeader, Select, Textarea } from "@/components/ui";
import { ConditionBadge, StatusBadge } from "@/components/badges";
import { RemoteGallery } from "@/components/images";
import { Timeline } from "@/components/timeline";
import { LocationPickers } from "@/components/location-pickers";
import { CLOSED_STATUSES, STATUSES, UNIT_TYPE_LABELS, canOperateStock } from "@/lib/constants";
import { formatCurrency, formatDateTime, formatProductId } from "@/lib/format";
import { can, PERMISSIONS } from "@/lib/permissions";

export default function ProductDetailPage() {
  const { id } = useParams();
  const [product, setProduct] = useState(null);
  const [me, setMe] = useState(null);
  const [locationTypes, setLocationTypes] = useState([]);
  const [locations, setLocations] = useState([]);
  const [locationForm, setLocationForm] = useState({ locationTypeId: "", locationId: "" });
  const [units, setUnits] = useState([]);
  const [toUnitId, setToUnitId] = useState("");
  const [transferNote, setTransferNote] = useState("");
  const [receiveForm, setReceiveForm] = useState({ locationTypeId: "", locationId: "" });

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
  const closed = CLOSED_STATUSES.includes(product.status);
  const inActiveUnit = Number(me.activeUnitId) === Number(product.unitId);
  const incomingHere = product.status === STATUSES.IN_TRANSIT && Number(product.transferToUnitId) === Number(me.activeUnitId);
  const operable = canOperateStock(product.status) && inActiveUnit;
  const destinations = units.filter((unit) => String(unit.id) !== String(product.unitId));

  async function runTransfer(action, extra = {}) {
    try {
      const data = await api("/api/stock/transfer", {
        method: "POST",
        json: { action, productId: product.id, ...extra },
      });
      toast.success(data.message);
      load();
    } catch (error) {
      toast.error(error.message);
    }
  }

  async function saveLocation() {
    try {
      const data = await api(`/api/products/${product.id}`, {
        method: "PATCH",
        json: { locationTypeId: locationForm.locationTypeId, locationId: locationForm.locationId || null },
      });
      toast.success(data.message);
      load();
    } catch (error) {
      toast.error(error.message);
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

  return (
    <div>
      <PageHeader
        title={formatProductId(product.id)}
        subtitle={product.commercialName || product.supplierModelCode || product.serialOnyx}
        actions={
          <>
            {canEdit && operable ? <Link href={`/estoque/${product.id}/editar`}><Button variant="secondary">Editar</Button></Link> : null}
            <Link href={`/estoque/${product.id}/imprimir`} target="_blank"><Button variant="secondary">Imprimir ficha</Button></Link>
            <Link href={`/estoque/${product.id}/etiqueta`} target="_blank"><Button variant="secondary">Imprimir etiqueta</Button></Link>
            {canMutate && operable && product.status === STATUSES.AVAILABLE ? <Button variant="secondary" onClick={() => runReserve()}>Reservar</Button> : null}
            {canMutate && operable && product.status === STATUSES.RESERVED ? <Button variant="secondary" onClick={() => runReserve("unreserve")}>Liberar reserva</Button> : null}
            {canMutate && operable && !closed ? <Link href={`/saida?id=${product.id}`}><Button>Dar baixa</Button></Link> : null}
            {canTransfer && inActiveUnit && product.status === STATUSES.AVAILABLE ? (
              <Link href={`/transferencias?id=${product.id}`}><Button variant="secondary">Transferir</Button></Link>
            ) : null}
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <Card className="overflow-hidden p-0">
          <img src={product.primaryImage?.fileUrl || "/logo.svg"} alt="" className="h-80 w-full object-cover bg-surface-2" />
        </Card>
        <Card className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <ConditionBadge condition={product.condition} />
            <StatusBadge status={product.status} />
          </div>
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
          <Info label="Tipo de localização" value={product.location?.locationType?.name} />
          <Info label="Localização" value={product.location?.name} />
          <Info label="Entrada" value={formatDateTime(product.entryDate)} />
          <Info label="Cadastrado por" value={product.createdBy?.name} />
          {canAssignLocation && operable ? (
            <div className="grid gap-3 pt-2 sm:grid-cols-2">
              <LocationPickers
                typeId={locationForm.locationTypeId}
                locationId={locationForm.locationId}
                types={locationTypes}
                locations={locations}
                onChange={setLocationForm}
              />
              <div className="sm:col-span-2">
                <Button type="button" variant="secondary" onClick={saveLocation}>Salvar localização</Button>
              </div>
            </div>
          ) : null}
          {canTransfer && inActiveUnit && product.status === STATUSES.AVAILABLE ? (
            <div className="space-y-2 border-t border-border pt-3">
              <p className="text-xs uppercase tracking-wide text-muted">Enviar para outra unidade</p>
              <Select value={toUnitId} onChange={(e) => setToUnitId(e.target.value)}>
                <option value="">Selecione o destino</option>
                {destinations.map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    {unit.name} ({UNIT_TYPE_LABELS[unit.type] || unit.type})
                  </option>
                ))}
              </Select>
              <Textarea value={transferNote} onChange={(e) => setTransferNote(e.target.value)} placeholder="Observação (opcional)" />
              <Button type="button" variant="secondary" disabled={!toUnitId} onClick={() => runTransfer("send", { toUnitId: Number(toUnitId), observation: transferNote })}>
                Enviar
              </Button>
            </div>
          ) : null}
          {canTransfer && inActiveUnit && product.status === STATUSES.IN_TRANSIT ? (
            <Button type="button" variant="secondary" onClick={() => runTransfer("cancel")}>Cancelar envio</Button>
          ) : null}
          {canTransfer && incomingHere ? (
            <div className="space-y-2 border-t border-border pt-3">
              <p className="text-xs uppercase tracking-wide text-muted">Confirmar recebimento</p>
              <LocationPickers
                typeId={receiveForm.locationTypeId}
                locationId={receiveForm.locationId}
                types={locationTypes}
                locations={locations}
                onChange={setReceiveForm}
              />
              <div className="flex flex-wrap gap-2">
                <Button type="button" onClick={() => runTransfer("receive", receiveForm)}>Receber nesta unidade</Button>
                <Button type="button" variant="secondary" onClick={() => runTransfer("refuse")}>Recusar</Button>
              </div>
            </div>
          ) : null}
          {!inActiveUnit && !incomingHere ? (
            <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">
              Este produto está em {product.unit?.name}. Troque o seletor de unidade para operar nele.
            </p>
          ) : null}
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
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

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-2 font-semibold">Descrição</h2>
          <p className="text-sm text-muted">{product.description || "Sem descrição."}</p>
          {product.damageDescription ? (
            <div className="mt-4 rounded-xl border border-orange-500/30 bg-orange-500/10 p-3 text-sm">
              <p className="font-semibold text-orange-300">Avarias</p>
              <p className="mt-1">{product.damageDescription}</p>
            </div>
          ) : null}
        </Card>
        <Card>
          <h2 className="mb-3 font-semibold">Histórico</h2>
          <Timeline items={product.movements} />
        </Card>
      </div>

      <Card className="mt-4">
        <h2 className="mb-3 font-semibold">Galeria</h2>
        <RemoteGallery
          product={product}
          canEdit={canPhoto && operable}
          onChanged={async () => {
            toast.success("Imagem atualizada.");
            load();
          }}
        />
        {canPhoto && operable ? (
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
    </div>
  );
}

function Info({ label, value }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-muted">{label}</p>
      <p className="text-sm font-medium">{value || "—"}</p>
    </div>
  );
}
