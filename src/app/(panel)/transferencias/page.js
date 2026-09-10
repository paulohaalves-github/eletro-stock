"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { X } from "lucide-react";
import { api } from "@/lib/api-client";
import { Button, Card, Field, PageHeader, Select, Textarea } from "@/components/ui";
import { ConditionBadge, StatusBadge } from "@/components/badges";
import { ConfirmDialog } from "@/components/modal";
import { LocationPickers } from "@/components/location-pickers";
import { ScanField } from "@/components/scan-field";
import { STATUSES, UNIT_TYPE_LABELS } from "@/lib/constants";
import { formatCurrency, formatProductId } from "@/lib/format";

function toggleId(setter, id, checked) {
  setter((current) => {
    const next = new Set(current);
    if (checked) next.add(id);
    else next.delete(id);
    return next;
  });
}

function toggleAll(setter, items, checked) {
  setter(() => {
    if (!checked) return new Set();
    return new Set(items.map((item) => item.id));
  });
}

function TransferenciasContent() {
  const params = useSearchParams();
  const [me, setMe] = useState(null);
  const [units, setUnits] = useState([]);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [batch, setBatch] = useState([]);
  const [toUnitId, setToUnitId] = useState("");
  const [observation, setObservation] = useState("");
  const [incoming, setIncoming] = useState([]);
  const [outgoing, setOutgoing] = useState([]);
  const [locationTypes, setLocationTypes] = useState([]);
  const [locations, setLocations] = useState([]);
  const [receivingId, setReceivingId] = useState(null);
  const [receiveForm, setReceiveForm] = useState({ locationTypeId: "", locationId: "" });
  const [batchReceiveForm, setBatchReceiveForm] = useState({ locationTypeId: "", locationId: "" });
  const [selectedIncoming, setSelectedIncoming] = useState(() => new Set());
  const [selectedOutgoing, setSelectedOutgoing] = useState(() => new Set());
  const [pending, setPending] = useState(null);
  const [loading, setLoading] = useState(false);

  async function loadLists() {
    const data = await api("/api/stock/transfer");
    setIncoming(data.incoming || []);
    setOutgoing(data.outgoing || []);
    setSelectedIncoming(new Set());
    setSelectedOutgoing(new Set());
  }

  useEffect(() => {
    Promise.all([
      api("/api/auth/me"),
      api("/api/units"),
      api("/api/location-types"),
      api("/api/locations"),
      api("/api/stock/transfer"),
    ]).then(([auth, unitData, types, locs, transfers]) => {
      setMe(auth.user);
      setUnits(unitData.items || []);
      setLocationTypes(types.items || []);
      setLocations(locs.items || []);
      setIncoming(transfers.incoming || []);
      setOutgoing(transfers.outgoing || []);
    }).catch((error) => toast.error(error.message));
  }, []);

  useEffect(() => {
    const raw = params.get("ids") || params.get("id");
    if (!raw) return;
    const ids = raw
      .split(",")
      .map((value) => Number(value.trim()))
      .filter((id) => Number.isInteger(id) && id > 0);
    if (!ids.length) return;
    api(`/api/products?ids=${ids.join(",")}`)
      .then((data) => {
        const items = data.items || [];
        const available = items.filter((item) => item.status === STATUSES.AVAILABLE);
        setBatch(available);
        if (!available.length) {
          toast.error("Nenhum produto disponível nesta unidade para montar o lote.");
        } else if (available.length < ids.length) {
          toast.message(`${available.length} de ${ids.length} produtos entraram no lote. Os demais não estão disponíveis aqui.`);
        }
      })
      .catch((error) => toast.error(error.message));
  }, [params]);

  useEffect(() => {
    const timeout = setTimeout(async () => {
      if (!query.trim()) {
        setResults([]);
        return;
      }
      const data = await api(`/api/search?q=${encodeURIComponent(query)}&limit=12`);
      setResults((data.items || []).filter((item) => item.status === STATUSES.AVAILABLE));
    }, 180);
    return () => clearTimeout(timeout);
  }, [query]);

  const destinations = units.filter((unit) => String(unit.id) !== String(me?.activeUnitId));
  const canSend = batch.length > 0 && Boolean(toUnitId) && batch.every((item) => item.status === STATUSES.AVAILABLE);
  const allIncomingSelected = incoming.length > 0 && incoming.every((item) => selectedIncoming.has(item.id));
  const allOutgoingSelected = outgoing.length > 0 && outgoing.every((item) => selectedOutgoing.has(item.id));

  function addToBatch(item) {
    if (item.status !== STATUSES.AVAILABLE) {
      toast.error("Somente produtos disponíveis entram no lote de envio.");
      return;
    }
    if (batch.some((product) => product.id === item.id)) {
      toast.message(`${formatProductId(item.id)} já está no lote.`);
      setResults([]);
      setQuery("");
      return;
    }
    setBatch((current) => [...current, item]);
    setResults([]);
    setQuery("");
  }

  function removeFromBatch(id) {
    setBatch((current) => current.filter((item) => item.id !== id));
  }

  async function addFromScan(parsed) {
    const text = String(parsed?.query || parsed?.raw || "").trim();
    if (!text) return;
    setQuery(text);
    try {
      const data = await api(`/api/search?q=${encodeURIComponent(text)}&limit=12`);
      const available = (data.items || []).filter((item) => item.status === STATUSES.AVAILABLE);
      if (available.length === 1) {
        addToBatch(available[0]);
        return;
      }
      setResults(available);
      if (!available.length) toast.error("Nenhum produto disponível encontrado.");
    } catch (error) {
      toast.error(error.message);
    }
  }

  async function runAction(action, extra = {}) {
    setLoading(true);
    try {
      const payload = { ...extra };
      delete payload.action;
      const data = await api("/api/stock/transfer", {
        method: "POST",
        json: { action, ...payload },
      });
      toast.success(data.message);
      setPending(null);
      setReceivingId(null);
      if (action === "send") {
        setBatch([]);
        setObservation("");
        setToUnitId("");
      }
      await loadLists();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  }

  const pendingCount = useMemo(() => {
    if (!pending?.productIds) return 1;
    return pending.productIds.length;
  }, [pending]);

  return (
    <div>
      <PageHeader
        title="Transferências entre unidades"
        subtitle={me?.activeUnit ? `Operando em ${me.activeUnit.name}. Monte um lote, envie e o destino confirma.` : "Selecione uma unidade no menu."}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 font-semibold">Enviar lote da unidade atual</h2>
          <Field label="Localizar e adicionar produto disponível">
            <ScanField value={query} onChange={setQuery} onScan={addFromScan} />
          </Field>
          {results.length ? (
            <div className="mt-3 divide-y divide-border rounded-xl border border-border">
              {results.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="flex w-full items-center gap-3 p-3 text-left hover:bg-surface-2"
                  onClick={() => addToBatch(item)}
                >
                  <img src={item.primaryImage?.fileUrl || "/logo.svg"} alt="" className="h-10 w-10 rounded-lg object-cover" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{formatProductId(item.id)} · {item.serialOnyx}</p>
                    <p className="text-xs text-muted">{item.commercialName || item.supplierModelCode}</p>
                  </div>
                  <StatusBadge status={item.status} />
                </button>
              ))}
            </div>
          ) : null}

          {batch.length ? (
            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium">{batch.length} aparelho(s) no lote</p>
                <button type="button" className="text-sm text-accent" onClick={() => setBatch([])}>
                  Limpar lote
                </button>
              </div>
              <div className="divide-y divide-border rounded-xl border border-border">
                {batch.map((item) => (
                  <div key={item.id} className="flex items-center gap-3 p-3">
                    <img src={item.primaryImage?.fileUrl || "/logo.svg"} alt="" className="h-10 w-10 rounded-lg object-cover" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{formatProductId(item.id)} · {item.serialOnyx}</p>
                      <p className="text-xs text-muted">{item.commercialName || item.supplierModelCode} · {formatCurrency(item.cashPrice)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <ConditionBadge condition={item.condition} />
                      <button
                        type="button"
                        className="rounded-lg p-1.5 text-muted hover:bg-surface-2 hover:text-text"
                        onClick={() => removeFromBatch(item.id)}
                        aria-label={`Remover ${formatProductId(item.id)}`}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <Field label="Unidade de destino">
                <Select value={toUnitId} onChange={(e) => setToUnitId(e.target.value)}>
                  <option value="">Selecione</option>
                  {destinations.map((unit) => (
                    <option key={unit.id} value={unit.id}>
                      {unit.name} ({UNIT_TYPE_LABELS[unit.type] || unit.type})
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Observação">
                <Textarea value={observation} onChange={(e) => setObservation(e.target.value)} />
              </Field>
              <Button
                disabled={!canSend}
                onClick={() => setPending({
                  action: "send",
                  productIds: batch.map((item) => item.id),
                  toUnitId: Number(toUnitId),
                  observation,
                })}
              >
                Enviar {batch.length} para conferência
              </Button>
            </div>
          ) : (
            <p className="mt-4 text-sm text-muted">Leia ou busque os produtos para montar o lote de envio.</p>
          )}
        </Card>

        <Card>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold">A receber nesta unidade</h2>
            {incoming.length ? (
              <button type="button" className="text-sm text-accent" onClick={() => toggleAll(setSelectedIncoming, incoming, !allIncomingSelected)}>
                {allIncomingSelected ? "Limpar seleção" : "Selecionar todos"}
              </button>
            ) : null}
          </div>
          {incoming.length ? (
            <div className="space-y-3">
              {selectedIncoming.size ? (
                <div className="space-y-3 rounded-xl border border-accent/40 bg-accent/5 p-3">
                  <p className="text-sm font-medium">{selectedIncoming.size} selecionado(s) para receber no mesmo local</p>
                  <div className="grid gap-3">
                    <LocationPickers
                      typeId={batchReceiveForm.locationTypeId}
                      locationId={batchReceiveForm.locationId}
                      types={locationTypes}
                      locations={locations}
                      onChange={setBatchReceiveForm}
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      onClick={() => setPending({
                        action: "receive",
                        productIds: [...selectedIncoming],
                        locationTypeId: batchReceiveForm.locationTypeId,
                        locationId: batchReceiveForm.locationId || null,
                      })}
                    >
                      Receber lote
                    </Button>
                    <Button variant="secondary" onClick={() => setPending({ action: "refuse", productIds: [...selectedIncoming] })}>
                      Recusar lote
                    </Button>
                  </div>
                </div>
              ) : null}
              {incoming.map((item) => (
                <div key={item.id} className="rounded-xl border border-border p-3">
                  <div className="flex items-start justify-between gap-3">
                    <label className="mt-1">
                      <input
                        type="checkbox"
                        checked={selectedIncoming.has(item.id)}
                        onChange={(event) => toggleId(setSelectedIncoming, item.id, event.target.checked)}
                        aria-label={`Selecionar ${formatProductId(item.id)}`}
                      />
                    </label>
                    <Link href={`/estoque/${item.id}`} className="min-w-0 flex-1">
                      <p className="font-medium">{formatProductId(item.id)} · {item.serialOnyx}</p>
                      <p className="text-xs text-muted">Origem: {item.unit?.name} · {item.catalogModel?.commercialName || item.supplierModelCode}</p>
                    </Link>
                    <StatusBadge status={item.status} />
                  </div>
                  {receivingId === item.id ? (
                    <div className="mt-3 grid gap-3">
                      <LocationPickers
                        typeId={receiveForm.locationTypeId}
                        locationId={receiveForm.locationId}
                        types={locationTypes}
                        locations={locations}
                        onChange={setReceiveForm}
                      />
                    </div>
                  ) : null}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {receivingId === item.id ? (
                      <Button
                        onClick={() => setPending({
                          action: "receive",
                          productIds: [item.id],
                          locationTypeId: receiveForm.locationTypeId,
                          locationId: receiveForm.locationId || null,
                        })}
                      >
                        Confirmar recebimento
                      </Button>
                    ) : (
                      <Button onClick={() => { setReceivingId(item.id); setReceiveForm({ locationTypeId: "", locationId: "" }); }}>
                        Receber
                      </Button>
                    )}
                    <Button variant="secondary" onClick={() => setPending({ action: "refuse", productIds: [item.id] })}>
                      Recusar
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted">Nenhum aparelho a caminho desta unidade.</p>
          )}
        </Card>
      </div>

      <Card className="mt-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">Enviados e aguardando conferência</h2>
          {outgoing.length ? (
            <div className="flex flex-wrap items-center gap-3">
              <button type="button" className="text-sm text-accent" onClick={() => toggleAll(setSelectedOutgoing, outgoing, !allOutgoingSelected)}>
                {allOutgoingSelected ? "Limpar seleção" : "Selecionar todos"}
              </button>
              {selectedOutgoing.size ? (
                <Button variant="secondary" onClick={() => setPending({ action: "cancel", productIds: [...selectedOutgoing] })}>
                  Cancelar envios ({selectedOutgoing.size})
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
        {outgoing.length ? (
          <div className="space-y-3">
            {outgoing.map((item) => (
              <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-3">
                <label className="flex min-w-0 flex-1 items-center gap-3">
                  <input
                    type="checkbox"
                    checked={selectedOutgoing.has(item.id)}
                    onChange={(event) => toggleId(setSelectedOutgoing, item.id, event.target.checked)}
                    aria-label={`Selecionar ${formatProductId(item.id)}`}
                  />
                  <Link href={`/estoque/${item.id}`} className="min-w-0">
                    <p className="font-medium">{formatProductId(item.id)} · {item.serialOnyx}</p>
                    <p className="text-xs text-muted">Destino: {item.transferToUnit?.name}</p>
                  </Link>
                </label>
                <div className="flex items-center gap-2">
                  <StatusBadge status={item.status} />
                  <Button variant="secondary" onClick={() => setPending({ action: "cancel", productIds: [item.id] })}>
                    Cancelar envio
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted">Nenhum envio pendente nesta unidade.</p>
        )}
      </Card>

      <ConfirmDialog
        open={Boolean(pending)}
        title={
          pending?.action === "send"
            ? pendingCount > 1 ? "Confirmar envio em lote" : "Confirmar envio"
            : pending?.action === "receive"
              ? pendingCount > 1 ? "Confirmar recebimento em lote" : "Confirmar recebimento"
              : pending?.action === "refuse"
                ? pendingCount > 1 ? "Recusar lote" : "Recusar recebimento"
                : pendingCount > 1 ? "Cancelar envios" : "Cancelar envio"
        }
        message={
          pending?.action === "send"
            ? pendingCount > 1
              ? `${pendingCount} produtos saem do estoque disponível e ficam em trânsito até a unidade de destino confirmar.`
              : "O produto sai do estoque disponível e fica em trânsito até a unidade de destino confirmar."
            : pending?.action === "receive"
              ? pendingCount > 1
                ? `${pendingCount} aparelhos entram no estoque desta unidade. Cadastro (preço e condição) permanece o mesmo.`
                : "O cadastro (preço e condição) permanece o mesmo. O aparelho entra no estoque desta unidade."
              : pending?.action === "refuse"
                ? pendingCount > 1
                  ? `${pendingCount} produtos voltam como disponíveis na unidade de origem.`
                  : "O produto volta como disponível na unidade de origem."
                : pendingCount > 1
                  ? `${pendingCount} produtos voltam como disponíveis nesta unidade.`
                  : "O produto volta como disponível nesta unidade."
        }
        confirmLabel="Confirmar"
        loading={loading}
        danger={pending?.action === "refuse" || pending?.action === "cancel"}
        onClose={() => setPending(null)}
        onConfirm={() => runAction(pending.action, pending)}
      />
    </div>
  );
}

export default function TransferenciasPage() {
  return (
    <Suspense>
      <TransferenciasContent />
    </Suspense>
  );
}
