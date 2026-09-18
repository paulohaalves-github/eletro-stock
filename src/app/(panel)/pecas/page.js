"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api-client";
import { Button, Card, Field, Input, PageHeader, Select, Textarea } from "@/components/ui";
import { LoadMore } from "@/components/paged-list";
import { LocationPickers } from "@/components/location-pickers";
import { Modal } from "@/components/modal";
import { cn, formatLocationPath } from "@/lib/format";
import { listQuery } from "@/lib/pagination";
import { usePagedList } from "@/hooks/use-paged-list";
import { can, PERMISSIONS } from "@/lib/permissions";
import { UNIT_TYPE_LABELS } from "@/lib/constants";

const emptyPart = { code: "", name: "", description: "" };
const emptyEntry = { partId: "", locationTypeId: "", locationId: "", quantity: "1", observation: "" };
const emptyMove = { partId: "", fromLocationId: "", toLocationTypeId: "", toLocationId: "", quantity: "1" };
const emptyTransfer = { partId: "", locationTypeId: "", locationId: "", toUnitId: "", quantity: "1" };

export default function PecasPage() {
  const [me, setMe] = useState(null);
  const list = usePagedList();
  const [searchText, setSearchText] = useState("");
  const [appliedQuery, setAppliedQuery] = useState("");
  const [panel, setPanel] = useState(null);
  const [selectedPartId, setSelectedPartId] = useState("");
  const [form, setForm] = useState(emptyPart);
  const [entry, setEntry] = useState(emptyEntry);
  const [move, setMove] = useState(emptyMove);
  const [transfer, setTransfer] = useState(emptyTransfer);
  const [types, setTypes] = useState([]);
  const [locations, setLocations] = useState([]);
  const [units, setUnits] = useState([]);
  const [pending, setPending] = useState([]);
  const [receiveForm, setReceiveForm] = useState({ locationTypeId: "", locationId: "" });

  function partsLoader(query) {
    return (page, pageSize) => api(`/api/parts?${listQuery({ q: query }, page, pageSize)}`);
  }

  async function load() {
    const [auth, locTypes, locs, unitData, transfers] = await Promise.all([
      api("/api/auth/me"),
      api("/api/location-types"),
      api("/api/locations"),
      api("/api/units"),
      api("/api/parts/transfer"),
    ]);
    setMe(auth.user);
    setTypes(locTypes.items || []);
    setLocations(locs.items || []);
    setUnits(unitData.items || []);
    setPending(transfers.items || []);
    await list.search(partsLoader(""));
  }

  useEffect(() => {
    void load().catch((error) => toast.error(error.message));
  }, []);

  const canManage = me && can(me.role, PERMISSIONS.PART_MANAGE);
  const canStock = me && can(me.role, PERMISSIONS.PART_STOCK);
  const selectedPart = list.items.find((item) => String(item.id) === String(selectedPartId));

  function openPanel(next) {
    setPanel(next);
  }

  function closePanel() {
    setPanel(null);
  }

  function selectPart(partId) {
    const id = String(partId || "");
    setSelectedPartId(id);
    setEntry((current) => ({ ...current, partId: id }));
    setMove((current) => ({ ...current, partId: id, fromLocationId: "" }));
    setTransfer((current) => ({ ...current, partId: id }));
  }

  async function searchParts(event) {
    event.preventDefault();
    const text = searchText.trim();
    setAppliedQuery(text);
    const result = await list.search(partsLoader(text));
    const nextItems = result?.items || [];
    if (selectedPartId && !nextItems.some((item) => String(item.id) === String(selectedPartId))) {
      selectPart("");
    }
  }

  async function refresh() {
    await Promise.all([
      list.search(partsLoader(appliedQuery)),
      api("/api/parts/transfer").then((transfers) => setPending(transfers.items || [])),
    ]);
  }

  async function createPart(event) {
    event.preventDefault();
    try {
      const data = await api("/api/parts", { method: "POST", json: form });
      toast.success(data.message);
      setForm(emptyPart);
      closePanel();
      await refresh();
    } catch (error) {
      toast.error(error.message);
    }
  }

  async function enterStock(event) {
    event.preventDefault();
    try {
      const data = await api("/api/parts/stock", {
        method: "POST",
        json: { action: "entry", partId: Number(entry.partId), locationId: Number(entry.locationId), quantity: Number(entry.quantity), observation: entry.observation },
      });
      toast.success(data.message);
      setEntry({ ...emptyEntry, partId: selectedPartId });
      await refresh();
      closePanel();
    } catch (error) {
      toast.error(error.message);
    }
  }

  async function moveStock(event) {
    event.preventDefault();
    try {
      const data = await api("/api/parts/stock", {
        method: "POST",
        json: {
          action: "move",
          partId: Number(move.partId),
          fromLocationId: Number(move.fromLocationId),
          toLocationId: Number(move.toLocationId),
          quantity: Number(move.quantity),
        },
      });
      toast.success(data.message);
      setMove({ ...emptyMove, partId: selectedPartId });
      await refresh();
      closePanel();
    } catch (error) {
      toast.error(error.message);
    }
  }

  async function sendTransfer(event) {
    event.preventDefault();
    try {
      const data = await api("/api/parts/transfer", {
        method: "POST",
        json: {
          partId: Number(transfer.partId),
          locationId: Number(transfer.locationId),
          toUnitId: Number(transfer.toUnitId),
          quantity: Number(transfer.quantity),
        },
      });
      toast.success(data.message);
      setTransfer({ ...emptyTransfer, partId: selectedPartId });
      await refresh();
      closePanel();
    } catch (error) {
      toast.error(error.message);
    }
  }

  async function receive(item) {
    try {
      const data = await api(`/api/parts/transfer/${item.id}`, {
        method: "POST",
        json: { action: "receive", locationId: Number(receiveForm.locationId) },
      });
      toast.success(data.message);
      setReceiveForm({ locationTypeId: "", locationId: "" });
      await refresh();
    } catch (error) {
      toast.error(error.message);
    }
  }

  async function actTransfer(item, action) {
    try {
      const data = await api(`/api/parts/transfer/${item.id}`, { method: "POST", json: { action } });
      toast.success(data.message);
      await refresh();
    } catch (error) {
      toast.error(error.message);
    }
  }

  const incoming = pending.filter((item) => Number(item.toUnitId) === Number(me?.activeUnitId));
  const outgoing = pending.filter((item) => Number(item.fromUnitId) === Number(me?.activeUnitId));
  const destinations = units.filter((unit) => String(unit.id) !== String(me?.activeUnitId));
  const partOptions = list.items.map((item) => (
    <option key={item.id} value={item.id}>{item.code} · {item.name}</option>
  ));

  return (
    <div className="w-full">
      <PageHeader
        title="Peças"
        subtitle="Consulte o saldo por unidade e use as ações só quando precisar cadastrar, entrar, mover ou transferir."
        actions={
          <>
            {canManage ? (
              <Button type="button" onClick={() => openPanel("create")}>Cadastrar peça</Button>
            ) : null}
            {canStock ? (
              <>
                <Button type="button" variant="secondary" onClick={() => openPanel("entry")}>Entrada</Button>
                <Button type="button" variant="secondary" onClick={() => openPanel("move")}>Mover</Button>
                <Button type="button" variant="secondary" onClick={() => openPanel("transfer")}>Enviar</Button>
              </>
            ) : null}
          </>
        }
      />

      <Card className="mb-4">
        <form onSubmit={searchParts} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <Field label="Consultar peça">
              <Input
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="Código ou nome da peça"
              />
            </Field>
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="secondary"
              disabled={list.loading}
              onClick={async () => {
                setSearchText("");
                setAppliedQuery("");
                const result = await list.search(partsLoader(""));
                const nextItems = result?.items || [];
                if (selectedPartId && !nextItems.some((item) => String(item.id) === String(selectedPartId))) {
                  selectPart("");
                }
              }}
            >
              Limpar filtros
            </Button>
            <Button type="submit" disabled={list.loading}>{list.loading ? "Buscando..." : "Buscar"}</Button>
          </div>
        </form>
      </Card>

      {pending.length ? (
        <Card className="mb-4 w-full overflow-hidden p-0">
          <div className="border-b border-border px-5 py-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Transferências em trânsito</p>
          </div>
          <div className="space-y-3 p-5">
            {outgoing.map((item) => (
              <div key={`out-${item.id}`} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border p-3">
                <p className="text-sm">{item.part?.code} · {item.quantity} un. para {item.toUnit?.name}</p>
                {canStock ? <Button variant="ghost" onClick={() => actTransfer(item, "cancel")}>Cancelar</Button> : null}
              </div>
            ))}
            {incoming.map((item) => (
              <div key={`in-${item.id}`} className="space-y-3 rounded-xl border border-border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm">{item.part?.code} · {item.quantity} un. de {item.fromUnit?.name}</p>
                  {canStock ? (
                    <div className="flex gap-2">
                      <Button onClick={() => { setReceiveForm({ locationTypeId: "", locationId: "" }); openPanel(`receive:${item.id}`); }}>Receber</Button>
                      <Button variant="ghost" onClick={() => actTransfer(item, "refuse")}>Recusar</Button>
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      <Card className="w-full overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="w-36 px-5 py-3 font-semibold">Código</th>
                <th className="px-5 py-3 font-semibold">Peça</th>
                <th className="w-28 px-5 py-3 font-semibold">Saldo</th>
                <th className="px-5 py-3 font-semibold">Localizações</th>
              </tr>
            </thead>
            <tbody>
              {list.items.map((item) => (
                <tr
                  key={item.id}
                  className={cn(
                    "cursor-pointer border-t border-border hover:bg-surface-2/80",
                    String(item.id) === String(selectedPartId) ? "bg-accent/10" : "",
                  )}
                  onClick={() => selectPart(String(item.id) === String(selectedPartId) ? "" : item.id)}
                >
                  <td className="px-5 py-4 font-mono text-accent">{item.code}</td>
                  <td className="px-5 py-4">
                    <p className="font-medium">{item.name}</p>
                    {!item.active ? <p className="text-xs text-muted">Inativa</p> : null}
                  </td>
                  <td className="px-5 py-4">{item.quantityInUnit || 0} un.</td>
                  <td className="px-5 py-4 text-muted">
                    {item.stocks?.length
                      ? item.stocks.map((stock) => `${formatLocationPath(stock.location)} (${stock.quantity})`).join(" · ")
                      : "Sem saldo nesta unidade"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!list.items.length ? (
          <p className="px-5 py-6 text-sm text-muted">
            {appliedQuery ? "Nenhuma peça encontrada para esta consulta." : "Nenhuma peça cadastrada."}
          </p>
        ) : null}
      </Card>
      <LoadMore
        shown={list.items.length}
        total={list.total}
        hasMore={list.hasMore}
        loading={list.loadingMore}
        onClick={() => void list.loadMore()}
      />

      <Modal
        open={panel === "create" && canManage}
        title="Cadastrar peça"
        onClose={closePanel}
        className="max-w-xl"
        footer={
          <>
            <Button type="button" variant="secondary" onClick={closePanel}>Cancelar</Button>
            <Button type="submit" form="part-create-form">Cadastrar peça</Button>
          </>
        }
      >
        <form id="part-create-form" onSubmit={createPart} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Código" required><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} /></Field>
            <Field label="Nome" required><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          </div>
          <Field label="Descrição"><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
        </form>
      </Modal>

      <Modal
        open={panel === "entry" && canStock}
        title="Entrada nesta unidade"
        onClose={closePanel}
        className="max-w-2xl"
        footer={
          <>
            <Button type="button" variant="secondary" onClick={closePanel}>Cancelar</Button>
            <Button type="submit" form="part-entry-form">Dar entrada</Button>
          </>
        }
      >
        <form id="part-entry-form" onSubmit={enterStock} className="space-y-3">
          {selectedPart ? <p className="text-sm text-muted">Peça selecionada: {selectedPart.code} · {selectedPart.name}</p> : <p className="text-sm text-muted">Selecione uma peça na lista ou no campo abaixo.</p>}
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Peça" required>
              <Select value={entry.partId} onChange={(e) => selectPart(e.target.value)}>
                <option value="">Selecione</option>
                {partOptions}
              </Select>
            </Field>
            <Field label="Quantidade" required>
              <Input type="number" min="1" value={entry.quantity} onChange={(e) => setEntry({ ...entry, quantity: e.target.value })} />
            </Field>
            <LocationPickers
              typeId={entry.locationTypeId}
              locationId={entry.locationId}
              types={types}
              locations={locations}
              onChange={(next) => setEntry({ ...entry, ...next })}
              required
            />
          </div>
        </form>
      </Modal>

      <Modal
        open={panel === "move" && canStock}
        title="Mover localização"
        onClose={closePanel}
        className="max-w-2xl"
        footer={
          <>
            <Button type="button" variant="secondary" onClick={closePanel}>Cancelar</Button>
            <Button type="submit" form="part-move-form">Mover</Button>
          </>
        }
      >
        <form id="part-move-form" onSubmit={moveStock} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Peça" required>
              <Select value={move.partId} onChange={(e) => selectPart(e.target.value)}>
                <option value="">Selecione</option>
                {partOptions}
              </Select>
            </Field>
            <Field label="De" required>
              <Select value={move.fromLocationId} onChange={(e) => setMove({ ...move, fromLocationId: e.target.value })} disabled={!move.partId}>
                <option value="">Selecione</option>
                {(selectedPart?.stocks || []).map((stock) => (
                  <option key={stock.id} value={stock.locationId}>
                    {formatLocationPath(stock.location)} ({stock.quantity})
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Quantidade" required>
              <Input type="number" min="1" value={move.quantity} onChange={(e) => setMove({ ...move, quantity: e.target.value })} />
            </Field>
            <LocationPickers
              typeId={move.toLocationTypeId}
              locationId={move.toLocationId}
              types={types}
              locations={locations}
              onChange={(next) => setMove({ ...move, toLocationTypeId: next.locationTypeId, toLocationId: next.locationId })}
              required
            />
          </div>
        </form>
      </Modal>

      <Modal
        open={panel === "transfer" && canStock}
        title="Enviar para outra unidade"
        onClose={closePanel}
        className="max-w-2xl"
        footer={
          <>
            <Button type="button" variant="secondary" onClick={closePanel}>Cancelar</Button>
            <Button type="submit" form="part-transfer-form">Enviar</Button>
          </>
        }
      >
        <form id="part-transfer-form" onSubmit={sendTransfer} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Peça" required>
              <Select value={transfer.partId} onChange={(e) => selectPart(e.target.value)}>
                <option value="">Selecione</option>
                {partOptions}
              </Select>
            </Field>
            <Field label="Quantidade" required>
              <Input type="number" min="1" value={transfer.quantity} onChange={(e) => setTransfer({ ...transfer, quantity: e.target.value })} />
            </Field>
            <LocationPickers
              typeId={transfer.locationTypeId}
              locationId={transfer.locationId}
              types={types}
              locations={locations}
              onChange={(next) => setTransfer({ ...transfer, ...next })}
              required
            />
            <Field label="Destino" required>
              <Select value={transfer.toUnitId} onChange={(e) => setTransfer({ ...transfer, toUnitId: e.target.value })}>
                <option value="">Selecione</option>
                {destinations.map((unit) => (
                  <option key={unit.id} value={unit.id}>{unit.name} ({UNIT_TYPE_LABELS[unit.type] || unit.type})</option>
                ))}
              </Select>
            </Field>
          </div>
        </form>
      </Modal>

      {incoming.map((item) => (
        <Modal
          key={`receive-modal-${item.id}`}
          open={panel === `receive:${item.id}` && canStock}
          title={`Receber ${item.part?.code || "peça"}`}
          onClose={closePanel}
          className="max-w-xl"
          footer={
            <>
              <Button type="button" variant="secondary" onClick={closePanel}>Cancelar</Button>
              <Button
                type="button"
                disabled={!receiveForm.locationId}
                onClick={async () => {
                  await receive(item);
                  closePanel();
                }}
              >
                Confirmar recebimento
              </Button>
            </>
          }
        >
          <p className="mb-3 text-sm text-muted">{item.quantity} un. de {item.fromUnit?.name}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <LocationPickers
              typeId={receiveForm.locationTypeId}
              locationId={receiveForm.locationId}
              types={types}
              locations={locations}
              onChange={setReceiveForm}
              required
            />
          </div>
        </Modal>
      ))}
    </div>
  );
}
