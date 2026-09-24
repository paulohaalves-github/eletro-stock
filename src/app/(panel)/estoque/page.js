"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { api } from "@/lib/api-client";
import { Button, Card, Input, PageHeader, Select } from "@/components/ui";
import { ActionMenu } from "@/components/action-menu";
import { ConditionBadge, StatusBadge } from "@/components/badges";
import {
  CONDITION_LABELS,
  ESTOQUE_PAGE_SIZE,
  PRICE_STALE_DAYS,
  STATUS_LABELS,
  STATUSES,
  VOLTAGE_LABELS,
} from "@/lib/constants";
import { formatCurrency, formatDate, formatProductId } from "@/lib/format";
import { ScanField } from "@/components/scan-field";
import { LabelModelPicker, openLabelPrint } from "@/components/label-model-picker";
import { ProductTrashDialog } from "@/components/product-trash-dialog";
import { PriceImportButton } from "@/components/price-import";
import { can, canAccessSaleOrderRecord, PERMISSIONS } from "@/lib/permissions";

const EMPTY_FILTERS = {
  categoryId: "",
  condition: "",
  status: "",
  voltage: "",
  minPrice: "",
  maxPrice: "",
  from: "",
  to: "",
  locationTypeId: "",
  locationId: "",
  stalePriceDays: "",
};

function buildQuery(pageNumber, q, filters) {
  const search = new URLSearchParams({
    page: String(pageNumber),
    pageSize: String(ESTOQUE_PAGE_SIZE),
  });
  if (q) search.set("q", q);
  for (const [key, value] of Object.entries(filters)) {
    if (value) search.set(key, value);
  }
  return search.toString();
}

function EstoqueContent() {
  const params = useSearchParams();
  const router = useRouter();
  const [view, setView] = useState("table");
  const [data, setData] = useState({ items: [], total: 0 });
  const [page, setPage] = useState(1);
  const [categories, setCategories] = useState([]);
  const [locationTypes, setLocationTypes] = useState([]);
  const [locations, setLocations] = useState([]);
  const [selected, setSelected] = useState(() => new Set());
  const [me, setMe] = useState(null);
  const [labelPickerOpen, setLabelPickerOpen] = useState(false);
  const [labelIds, setLabelIds] = useState([]);
  const [q, setQ] = useState(params.get("q") || "");
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [applied, setApplied] = useState({ q: params.get("q") || "", filters: EMPTY_FILTERS });
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [trashing, setTrashing] = useState(false);
  const [trashOpen, setTrashOpen] = useState(false);

  const fetchPage = useCallback(async (pageNumber, { append = false, qValue, filterValue } = {}) => {
    const searchQ = qValue !== undefined ? qValue : q;
    const searchFilters = filterValue || filters;
    if (append) setLoadingMore(true);
    else setLoading(true);
    try {
      const result = await api(`/api/products?${buildQuery(pageNumber, searchQ, searchFilters)}`);
      setData((current) =>
        append ? { ...result, items: [...current.items, ...result.items] } : result,
      );
      setPage(pageNumber);
      if (!append) {
        setSelected(new Set());
        setApplied({ q: searchQ, filters: searchFilters });
      }
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [q, filters]);

  useEffect(() => {
    Promise.all([api("/api/auth/me"), api("/api/categories"), api("/api/location-types"), api("/api/locations")]).then(([auth, c, types, locs]) => {
      setMe(auth.user);
      setCategories(c.items || []);
      setLocationTypes(types.items || []);
      setLocations(locs.items || []);
    });
  }, []);

  useEffect(() => {
    void fetchPage(1, { qValue: params.get("q") || "" });
    // Carga inicial: busca só no mount (e quando a URL já traz ?q=).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const allVisibleSelected = data.items.length > 0 && data.items.every((item) => selected.has(item.id));
  const hasMore = data.items.length < data.total;
  const canTransfer = me ? can(me.role, PERMISSIONS.STOCK_TRANSFER) : false;
  const canTrash = me ? can(me.role, PERMISSIONS.PRODUCT_TRASH) : false;
  const canImportPrices = me ? can(me.role, PERMISSIONS.PRICE_IMPORT) : false;

  function searchNow(qValue) {
    if (qValue !== undefined) {
      setQ(qValue);
      router.push(qValue ? `/estoque?q=${encodeURIComponent(qValue)}` : "/estoque");
    }
    void fetchPage(1, { qValue: qValue !== undefined ? qValue : q });
  }

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
      data.items.forEach((item) => {
        if (checked) next.add(item.id);
        else next.delete(item.id);
      });
      return next;
    });
  }

  function printLabels(ids) {
    if (!ids.length) return;
    setLabelIds(ids);
    setLabelPickerOpen(true);
  }

  function confirmLabelModel(model) {
    openLabelPrint({ productIds: labelIds, model });
    setLabelPickerOpen(false);
    setLabelIds([]);
  }

  function transferSelected() {
    const ids = data.items
      .filter((item) => selected.has(item.id) && item.status === STATUSES.AVAILABLE)
      .map((item) => item.id);
    if (!ids.length) {
      toast.error("Selecione produtos disponíveis para transferir.");
      return;
    }
    if (ids.length < selected.size) {
      toast.message(`${ids.length} disponível(is) no lote. Os demais não podem ser transferidos.`);
    }
    router.push(`/transferencias?ids=${ids.join(",")}`);
  }

  async function trashSelected(observation) {
    const ids = [...selected];
    if (!ids.length) return;
    setTrashing(true);
    try {
      const data = await api("/api/products/trash", { method: "POST", json: { productIds: ids, observation } });
      toast.success(data.message);
      setTrashOpen(false);
      setSelected(new Set());
      await fetchPage(1, { qValue: applied.q, filterValue: applied.filters });
    } catch (error) {
      toast.error(error.message);
    } finally {
      setTrashing(false);
    }
  }

  async function exportExcel() {
    setExporting(true);
    try {
      const ids = [...selected];
      const blob = await api("/api/products/export", {
        method: "POST",
        json: ids.length ? { ids } : { q: applied.q, ...applied.filters },
        blob: true,
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "estoque.xlsx";
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setExporting(false);
    }
  }

  const exportLabel = selected.size
    ? `Exportar selecionados (${selected.size})`
    : data.total
      ? `Exportar resultado do filtro (${data.total})`
      : "Exportar Excel";

  return (
    <div>
      <PageHeader
        title="Produtos"
        subtitle={data.total ? `${data.total} aparelho(s) nesta unidade` : "Busque e filtre o estoque desta unidade."}
        actions={
          <>
            <ActionMenu
              items={[
                canTransfer
                  ? {
                      label: `Transferir lote${selected.size ? ` (${selected.size})` : ""}`,
                      disabled: !selected.size,
                      onClick: transferSelected,
                    }
                  : null,
                canTrash
                  ? {
                      label: `Mover para a lixeira${selected.size ? ` (${selected.size})` : ""}`,
                      disabled: !selected.size || trashing,
                      danger: true,
                      onClick: () => setTrashOpen(true),
                    }
                  : null,
                {
                  label: `Imprimir etiquetas${selected.size ? ` (${selected.size})` : ""}`,
                  disabled: !selected.size,
                  onClick: () => printLabels([...selected]),
                },
                {
                  label: exporting ? "Exportando..." : exportLabel,
                  disabled: exporting || (!selected.size && !data.total),
                  onClick: exportExcel,
                },
                {
                  label: view === "table" ? "Ver cards" : "Ver tabela",
                  onClick: () => setView(view === "table" ? "cards" : "table"),
                },
              ]}
            />
            {canImportPrices ? (
              <PriceImportButton onApplied={() => void fetchPage(1, { qValue: applied.q, filterValue: applied.filters })} />
            ) : null}
            <Link href="/entrada">
              <Button>Nova entrada</Button>
            </Link>
          </>
        }
      />

      <Card className="mb-4 space-y-3">
        <ScanField
          value={q}
          onChange={setQ}
          onScan={(parsed) => {
            const text = parsed.query ?? parsed.raw ?? "";
            searchNow(text);
          }}
          placeholder="ID, Serial Onyx, EAN, model code, categoria..."
        />
        <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
          <Select value={filters.categoryId} onChange={(e) => setFilters({ ...filters, categoryId: e.target.value })}>
            <option value="">Categoria</option>
            {categories.map((item) => (
              <option key={item.id} value={item.id}>{item.name}</option>
            ))}
          </Select>
          <Select value={filters.condition} onChange={(e) => setFilters({ ...filters, condition: e.target.value })}>
            <option value="">Condição</option>
            {Object.entries(CONDITION_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </Select>
          <Select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
            <option value="">Status</option>
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </Select>
          <Select value={filters.voltage} onChange={(e) => setFilters({ ...filters, voltage: e.target.value })}>
            <option value="">Tensão</option>
            {Object.entries(VOLTAGE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </Select>
          <Input placeholder="Preço mín." value={filters.minPrice} onChange={(e) => setFilters({ ...filters, minPrice: e.target.value })} />
          <Input placeholder="Preço máx." value={filters.maxPrice} onChange={(e) => setFilters({ ...filters, maxPrice: e.target.value })} />
          <Input type="date" value={filters.from} onChange={(e) => setFilters({ ...filters, from: e.target.value })} />
          <Select
            value={filters.stalePriceDays}
            onChange={(e) => setFilters({ ...filters, stalePriceDays: e.target.value })}
          >
            <option value="">Preço desatualizado</option>
            {PRICE_STALE_DAYS.map((item) => (
              <option key={item.value} value={item.value}>{item.label}</option>
            ))}
          </Select>
          <Select
            value={filters.locationTypeId}
            onChange={(e) => setFilters({ ...filters, locationTypeId: e.target.value, locationId: "" })}
          >
            <option value="">Tipo de localização</option>
            {locationTypes.map((item) => (
              <option key={item.id} value={item.id}>{item.name}</option>
            ))}
          </Select>
          <Select
            value={filters.locationId}
            onChange={(e) => setFilters({ ...filters, locationId: e.target.value })}
            disabled={!filters.locationTypeId}
          >
            <option value="">{filters.locationTypeId ? "Todas as localizações" : "Selecione o tipo"}</option>
            {locations
              .filter((item) => String(item.locationTypeId) === String(filters.locationTypeId))
              .map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
          </Select>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          {data.items.length ? (
            <button type="button" className="text-sm text-accent" onClick={() => toggleVisible(!allVisibleSelected)}>
              {allVisibleSelected ? "Limpar seleção visível" : "Selecionar visíveis"}
            </button>
          ) : <span />}
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setQ("");
                setFilters(EMPTY_FILTERS);
                router.push("/estoque");
                void fetchPage(1, { qValue: "", filterValue: EMPTY_FILTERS });
              }}
              disabled={loading}
            >
              Limpar filtros
            </Button>
            <Button type="button" onClick={() => searchNow()} disabled={loading}>
              {loading ? "Buscando..." : "Buscar"}
            </Button>
          </div>
        </div>
      </Card>

      {loading && !data.items.length ? (
        <p className="text-sm text-muted">Carregando produtos...</p>
      ) : null}

      {!loading && !data.items.length ? (
        <p className="text-sm text-muted">Nenhum produto encontrado. Ajuste os filtros e clique em Buscar.</p>
      ) : null}

      {data.items.length && view === "cards" ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {data.items.map((item) => (
            <div key={item.id} className="card relative overflow-hidden hover:border-accent/50">
              <label className="absolute top-3 left-3 z-10 rounded-md bg-black/50 p-1.5" onClick={(event) => event.stopPropagation()}>
                <input
                  type="checkbox"
                  checked={selected.has(item.id)}
                  onChange={(event) => toggleSelected(item.id, event.target.checked)}
                />
              </label>
              <Link href={`/estoque/${item.id}`} className="block">
                <img src={item.primaryImage?.fileUrl || "/logo.svg"} alt="" className="h-40 w-full object-cover bg-surface-2" />
                <div className="space-y-2 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-mono text-sm text-accent">{formatProductId(item.id)}</p>
                    <StatusBadge status={item.status} />
                  </div>
                  <p className="font-medium">{item.commercialName || item.supplierModelCode || item.category?.name}</p>
                  <p className="text-xs text-muted">
                    {item.serialOnyx} · {item.category?.name}
                    {item.voltage ? ` · ${item.voltage}` : ""}
                    {item.locationPath ? ` · ${item.locationPath}` : ""}
                  </p>
                  <div className="flex items-center justify-between">
                    <ConditionBadge condition={item.condition} />
                    <span className="text-sm font-semibold">{formatCurrency(item.cashPrice)}</span>
                  </div>
                  <p className="text-xs text-muted">Preço atualizado em {formatDate(item.lastPriceUpdateAt)}</p>
                  {item.openSaleOrder ? <p className="text-xs text-muted">{saleOrderCell(item, me)}</p> : null}
                </div>
              </Link>
            </div>
          ))}
        </div>
      ) : null}

      {data.items.length && view === "table" ? (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[1160px] text-left text-sm">
            <thead className="text-xs uppercase text-muted">
              <tr>
                <th className="px-3 py-3">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={(event) => toggleVisible(event.target.checked)}
                    aria-label="Selecionar visíveis"
                  />
                </th>
                {["Foto", "ID", "Serial Onyx", "Nome comercial", "Categoria", "Tipo de localização", "Localização", "Model Code", "EAN", "Capacidade", "Tensão", "Condição", "À vista", "Parcelado", "Preço atualizado", "Status", "Venda", "Entrada"].map((col) => (
                  <th key={col} className="px-3 py-3 font-semibold">{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.items.map((item) => (
                <tr key={item.id} className="cursor-pointer border-t border-border hover:bg-surface-2" onClick={() => router.push(`/estoque/${item.id}`)}>
                  <td className="px-3 py-2" onClick={(event) => event.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selected.has(item.id)}
                      onChange={(event) => toggleSelected(item.id, event.target.checked)}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <img src={item.primaryImage?.fileUrl || "/logo.svg"} alt="" className="h-10 w-10 rounded-lg object-cover" />
                  </td>
                  <td className="px-3 py-2 font-mono text-accent">{formatProductId(item.id)}</td>
                  <td className="px-3 py-2">{item.serialOnyx || "—"}</td>
                  <td className="px-3 py-2">{item.commercialName || "—"}</td>
                  <td className="px-3 py-2">{item.category?.name}</td>
                  <td className="px-3 py-2">{item.location?.locationType?.name || "—"}</td>
                  <td className="px-3 py-2">{item.location?.name || "—"}</td>
                  <td className="px-3 py-2">{item.supplierModelCode || "—"}</td>
                  <td className="px-3 py-2">{item.ean || "—"}</td>
                  <td className="px-3 py-2">{item.capacitySizeType || "—"}</td>
                  <td className="px-3 py-2">{item.voltage || "—"}</td>
                  <td className="px-3 py-2"><ConditionBadge condition={item.condition} /></td>
                  <td className="px-3 py-2">{formatCurrency(item.cashPrice)}</td>
                  <td className="px-3 py-2">{formatCurrency(item.installmentPrice)}</td>
                  <td className="px-3 py-2">{formatDate(item.lastPriceUpdateAt)}</td>
                  <td className="px-3 py-2"><StatusBadge status={item.status} /></td>
                  <td className="px-3 py-2 text-xs text-muted">{saleOrderCell(item, me)}</td>
                  <td className="px-3 py-2">{formatDate(item.entryDate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {data.items.length ? (
        <div className="mt-4 flex flex-col items-center gap-2">
          <p className="text-sm text-muted">
            Exibindo {data.items.length} de {data.total}
          </p>
          {hasMore ? (
            <Button
              type="button"
              variant="secondary"
              disabled={loadingMore}
              onClick={() => void fetchPage(page + 1, { append: true, qValue: applied.q, filterValue: applied.filters })}
            >
              {loadingMore ? "Carregando..." : "Carregar mais"}
            </Button>
          ) : null}
        </div>
      ) : null}

      <LabelModelPicker
        open={labelPickerOpen}
        onClose={() => {
          setLabelPickerOpen(false);
          setLabelIds([]);
        }}
        onSelect={confirmLabelModel}
      />
      <ProductTrashDialog
        open={trashOpen}
        count={selected.size}
        loading={trashing}
        onConfirm={trashSelected}
        onClose={() => !trashing && setTrashOpen(false)}
      />
    </div>
  );
}

export default function EstoquePage() {
  return (
    <Suspense>
      <EstoqueContent />
    </Suspense>
  );
}

function saleOrderCell(item, me) {
  if (!item.openSaleOrder) return "—";
  const canSee = me && canAccessSaleOrderRecord(me, item.openSaleOrder);
  if (canSee) {
    if (item.openSaleOrder.reservedUntil) {
      return `${item.openSaleOrder.number} · até ${formatDate(item.openSaleOrder.reservedUntil)}`;
    }
    return item.openSaleOrder.itemStatus === "INTERESSE"
      ? `${item.openSaleOrder.number} · interesse`
      : item.openSaleOrder.number;
  }
  return item.openSaleOrder.reservedUntil ? "Reservado em outra venda" : "Em outra venda";
}
