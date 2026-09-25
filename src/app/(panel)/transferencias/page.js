"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { X } from "lucide-react";
import { api } from "@/lib/api-client";
import { Button, Card, Field, PageHeader, Select, Textarea } from "@/components/ui";
import { LoadMore, SearchActions } from "@/components/paged-list";
import { ConditionBadge, StatusBadge } from "@/components/badges";
import { ConfirmDialog } from "@/components/modal";
import { LocationPickers } from "@/components/location-pickers";
import { ScanField } from "@/components/scan-field";
import { STATUSES, UNIT_TYPE_LABELS } from "@/lib/constants";
import { cn, formatCurrency, formatProductId } from "@/lib/format";
import { listQuery } from "@/lib/pagination";
import { MAX_TRANSFER_BATCH } from "@/lib/validations";
import { usePagedList } from "@/hooks/use-paged-list";

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
    const ids = items.map((item) => item.id);
    if (ids.length > MAX_TRANSFER_BATCH) {
      toast.error(`Selecione no máximo ${MAX_TRANSFER_BATCH} produtos por lote.`);
      return new Set(ids.slice(0, MAX_TRANSFER_BATCH));
    }
    return new Set(ids);
  });
}

function looksLikeProductId(parsed, raw) {
  if (parsed?.productId) return true;
  const type = parsed?.type;
  if (type === "INTERNAL" || type === "QR") return true;
  return /^#?\d+$/.test(raw) || /^ES-\d+$/i.test(raw);
}

function findIncomingByScan(parsed, items) {
  const raw = String(parsed?.query ?? parsed?.raw ?? "").trim();
  if (!raw) return { error: "Leia o ID ou o Serial Onyx." };

  const idCandidate = Number(String(parsed?.productId || raw).replace(/^#/, "").replace(/^ES-/i, ""));
  if (looksLikeProductId(parsed, raw) && Number.isInteger(idCandidate) && idCandidate > 0) {
    const byId = items.find((item) => item.id === idCandidate);
    if (byId) return { item: byId };
  }

  const serialKey = raw.toLowerCase();
  const exactSerial = items.filter((item) => String(item.serialOnyx || "").toLowerCase() === serialKey);
  if (exactSerial.length === 1) return { item: exactSerial[0] };
  if (exactSerial.length > 1) return { error: "Mais de um aparelho com esse serial. Use o ID." };

  if (!looksLikeProductId(parsed, raw)) {
    const partial = items.filter((item) => String(item.serialOnyx || "").toLowerCase().includes(serialKey));
    if (partial.length === 1) return { item: partial[0] };
    if (partial.length > 1) return { error: "Mais de um aparelho combina. Use o ID." };
  }

  return { error: "Esse aparelho não está na lista a receber." };
}

function TransferenciasContent() {
  const params = useSearchParams();
  const [me, setMe] = useState(null);
  const [units, setUnits] = useState([]);
  const [query, setQuery] = useState("");
  const results = usePagedList();
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
  const [receiveScan, setReceiveScan] = useState("");
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
    if (ids.length > MAX_TRANSFER_BATCH) {
      toast.error(`O lote admite no máximo ${MAX_TRANSFER_BATCH} produtos. Os primeiros ${MAX_TRANSFER_BATCH} foram carregados.`);
    }
    api(`/api/products?ids=${ids.slice(0, MAX_TRANSFER_BATCH).join(",")}`)
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

  const destinations = units.filter((unit) => String(unit.id) !== String(me?.activeUnitId));
  const canSend = batch.length > 0 && Boolean(toUnitId) && batch.every((item) => item.status === STATUSES.AVAILABLE);
  const allIncomingSelected = incoming.length > 0 && incoming.every((item) => selectedIncoming.has(item.id));
  const allOutgoingSelected = outgoing.length > 0 && outgoing.every((item) => selectedOutgoing.has(item.id));

  async function searchAvailable(text) {
    const value = text !== undefined ? text : query;
    if (text !== undefined) setQuery(text);
    if (!String(value || "").trim()) {
      results.setItems([]);
      return [];
    }
    const data = await results.search(async (page, pageSize) => {
      const payload = await api(`/api/search?${listQuery({ q: value }, page, pageSize)}`);
      return {
        ...payload,
        items: (payload.items || []).filter((item) => item.status === STATUSES.AVAILABLE),
      };
    });
    return data?.items || [];
  }

  function addToBatch(item) {
    if (item.status !== STATUSES.AVAILABLE) {
      toast.error("Somente produtos disponíveis entram no lote de envio.");
      return;
    }
    if (batch.some((product) => product.id === item.id)) {
      toast.message(`${formatProductId(item.id)} já está no lote.`);
      results.setItems([]);
      setQuery("");
      return;
    }
    if (batch.length >= MAX_TRANSFER_BATCH) {
      toast.error(`O lote admite no máximo ${MAX_TRANSFER_BATCH} produtos.`);
      return;
    }
    setBatch((current) => [...current, item]);
    results.setItems([]);
    setQuery("");
  }

  function removeFromBatch(id) {
    setBatch((current) => current.filter((item) => item.id !== id));
  }

  function selectIncomingFromScan(parsed) {
    const result = findIncomingByScan(parsed, incoming);
    setReceiveScan("");
    if (result.error) {
      toast.error(result.error);
      return;
    }
    const item = result.item;
    let already = false;
    let atLimit = false;
    setSelectedIncoming((current) => {
      already = current.has(item.id);
      if (already) return current;
      if (current.size >= MAX_TRANSFER_BATCH) {
        atLimit = true;
        return current;
      }
      const next = new Set(current);
      next.add(item.id);
      return next;
    });
    if (atLimit) {
      toast.error(`O lote admite no máximo ${MAX_TRANSFER_BATCH} produtos.`);
      return;
    }
    if (already) {
      toast.message(`${formatProductId(item.id)} já está selecionado.`);
    } else {
      toast.success(`${formatProductId(item.id)} selecionado para recebimento.`);
    }
    requestAnimationFrame(() => {
      document.getElementById(`incoming-${item.id}`)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  }

  async function addFromScan(parsed) {
    const text = String(parsed?.query || parsed?.raw || "").trim();
    if (!text) return;
    try {
      const available = await searchAvailable(text);
      if (available.length === 1) {
        addToBatch(available[0]);
        return;
      }
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

      <div className="w-full space-y-4">
        <Card>
          <h2 className="mb-3 font-semibold">Enviar lote da unidade atual</h2>
          <Field label="Localizar e adicionar produto disponível">
            <ScanField value={query} onChange={setQuery} onScan={addFromScan} />
          </Field>
          <div className="mt-3">
            <SearchActions
              loading={results.loading}
              onSearch={() => void searchAvailable()}
              onClear={() => {
                setQuery("");
                results.setItems([]);
              }}
            />
          </div>
          {results.items.length ? (
            <div className="mt-3 divide-y divide-border rounded-xl border border-border">
              {results.items.map((item) => (
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
          <LoadMore
            shown={results.items.length}
            total={results.total}
            hasMore={results.hasMore}
            loading={results.loadingMore}
            onClick={() => void results.loadMore()}
          />

          {batch.length ? (
            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium">{batch.length} aparelho(s) no lote{batch.length >= MAX_TRANSFER_BATCH ? ` (limite ${MAX_TRANSFER_BATCH})` : ""}</p>
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
              <Field label="Bipar ID ou Serial Onyx para selecionar o lote">
                <ScanField
                  value={receiveScan}
                  onChange={setReceiveScan}
                  onScan={selectIncomingFromScan}
                  placeholder="Bipar o ID ou o Serial Onyx"
                />
              </Field>
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
                <div
                  id={`incoming-${item.id}`}
                  key={item.id}
                  className={cn(
                    "rounded-xl border p-3",
                    selectedIncoming.has(item.id) ? "border-accent bg-accent/5" : "border-border",
                  )}
                >
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

        <Card>
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
      </div>

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
