"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { api } from "@/lib/api-client";
import { Button, Card, Field, Input, PageHeader, Select } from "@/components/ui";
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
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn, formatCurrency, formatDate, formatProductId } from "@/lib/format";
import { ScanField } from "@/components/scan-field";
import { LabelModelPicker, openLabelPrint } from "@/components/label-model-picker";
import { ProductTrashDialog } from "@/components/product-trash-dialog";
import { PriceImportButton } from "@/components/price-import";
import { can, canAccessSaleOrderRecord, PERMISSIONS } from "@/lib/permissions";
import {
  EMPTY_ESTOQUE_FILTERS,
  EMPTY_ESTOQUE_SORT,
  clearEstoqueListState,
  estoqueListPath,
  filtersFromParams,
  hasEstoqueListQuery,
  readEstoqueListState,
  sortFromParams,
  writeEstoqueListState,
} from "@/lib/estoque-list-state";
import { parseFilterList } from "@/lib/filter-list";
import { MAX_TRANSFER_BATCH } from "@/lib/validations";
import { MultiSelect } from "@/components/multi-select";

const EMPTY_FILTERS = EMPTY_ESTOQUE_FILTERS;

const ADVANCED_FILTER_KEYS = [
  "voltage",
  "minPrice",
  "maxPrice",
  "from",
  "priceUpdatedOn",
  "stalePriceDays",
  "locationTypeId",
  "locationId",
  "commercialPhoto",
];

function hasAdvancedFilters(filters) {
  return ADVANCED_FILTER_KEYS.some((key) => String(filters?.[key] || "").trim());
}

function multiLabel(value, options, emptyLabel) {
  const ids = parseFilterList(value);
  if (!ids.length) return emptyLabel;
  const labels = ids
    .map((id) => options.find((item) => String(item.value) === String(id))?.label || id)
    .filter(Boolean);
  if (!labels.length) return emptyLabel;
  if (labels.length === 1) return labels[0];
  return `${labels[0]} +${labels.length - 1}`;
}

function buildQuery(pageNumber, q, filters, sortState) {
  const search = new URLSearchParams({
    page: String(pageNumber),
    pageSize: String(ESTOQUE_PAGE_SIZE),
  });
  if (q) search.set("q", q);
  for (const [key, value] of Object.entries(filters)) {
    if (value) search.set(key, value);
  }
  if (sortState?.sort) {
    search.set("sort", sortState.sort);
    search.set("dir", sortState.dir === "desc" ? "desc" : "asc");
  }
  return search.toString();
}

const TABLE_COLUMNS = [
  { key: "photo", label: "Foto" },
  { key: "commercialPhoto", label: "Foto comercial" },
  { key: "id", label: "ID", sort: "id" },
  { key: "serialOnyx", label: "Serial Onyx", sort: "serialOnyx" },
  { key: "commercialName", label: "Nome comercial", sort: "commercialName" },
  { key: "category", label: "Categoria", sort: "category" },
  { key: "locationType", label: "Tipo de localização", sort: "locationType" },
  { key: "location", label: "Localização", sort: "location" },
  { key: "supplierModelCode", label: "Model Code", sort: "supplierModelCode" },
  { key: "ean", label: "EAN", sort: "ean" },
  { key: "capacitySizeType", label: "Capacidade", sort: "capacitySizeType" },
  { key: "voltage", label: "Tensão", sort: "voltage" },
  { key: "condition", label: "Condição", sort: "condition" },
  { key: "cashPrice", label: "À vista", sort: "cashPrice" },
  { key: "soldPrice", label: "Valor vendido" },
  { key: "installmentPrice", label: "Parcelado", sort: "installmentPrice" },
  { key: "lastPriceUpdateAt", label: "Preço atualizado", sort: "lastPriceUpdateAt" },
  { key: "status", label: "Status", sort: "status" },
  { key: "sale", label: "Venda" },
  { key: "entryDate", label: "Entrada", sort: "entryDate" },
];

function SortHeader({ column, sortState, onSort }) {
  if (!column.sort) {
    return <span className="font-semibold">{column.label}</span>;
  }
  const active = sortState.sort === column.sort;
  const ariaSort = !active ? "none" : sortState.dir === "desc" ? "descending" : "ascending";
  return (
    <button
      type="button"
      className={cn(
        "-mx-1 inline-flex items-center gap-1 rounded px-1 font-semibold uppercase tracking-wide hover:text-text",
        active ? "text-text" : "text-muted",
      )}
      aria-sort={ariaSort}
      onClick={(event) => {
        event.stopPropagation();
        onSort(column.sort);
      }}
    >
      {column.label}
      <span className="flex flex-col leading-none">
        <ChevronUp className={cn("h-3 w-3", active && sortState.dir === "asc" ? "text-accent" : "opacity-40")} />
        <ChevronDown className={cn("-mt-1 h-3 w-3", active && sortState.dir === "desc" ? "text-accent" : "opacity-40")} />
      </span>
    </button>
  );
}

function EstoqueContent() {
  const params = useSearchParams();
  const router = useRouter();
  const [view, setView] = useState("table");
  const [data, setData] = useState({ items: [], total: 0 });
  const [page, setPage] = useState(1);
  const [categories, setCategories] = useState([]);
  const [manufacturers, setManufacturers] = useState([]);
  const [locationTypes, setLocationTypes] = useState([]);
  const [locations, setLocations] = useState([]);
  const [selected, setSelected] = useState(() => new Set());
  const [me, setMe] = useState(null);
  const [labelPickerOpen, setLabelPickerOpen] = useState(false);
  const [labelIds, setLabelIds] = useState([]);
  const [q, setQ] = useState(params.get("q") || "");
  const [filters, setFilters] = useState(() => filtersFromParams(params));
  const [sort, setSort] = useState(() => sortFromParams(params));
  const [applied, setApplied] = useState(() => ({
    q: params.get("q") || "",
    filters: filtersFromParams(params),
    sort: sortFromParams(params),
  }));
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [trashing, setTrashing] = useState(false);
  const [trashOpen, setTrashOpen] = useState(false);
  const [moreFiltersOpen, setMoreFiltersOpen] = useState(() => hasAdvancedFilters(filtersFromParams(params)));

  const fetchPage = useCallback(async (pageNumber, { append = false, qValue, filterValue, sortValue } = {}) => {
    const searchQ = qValue !== undefined ? qValue : q;
    const searchFilters = filterValue || filters;
    const searchSort = sortValue !== undefined ? sortValue : sort;
    if (append) setLoadingMore(true);
    else setLoading(true);
    try {
      const result = await api(`/api/products?${buildQuery(pageNumber, searchQ, searchFilters, searchSort)}`);
      setData((current) =>
        append ? { ...result, items: [...current.items, ...result.items] } : result,
      );
      setPage(pageNumber);
      if (!append) {
        setSelected(new Set());
        setApplied({ q: searchQ, filters: searchFilters, sort: searchSort });
        writeEstoqueListState(searchQ, searchFilters, searchSort);
      }
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [q, filters, sort]);

  useEffect(() => {
    Promise.all([api("/api/auth/me"), api("/api/categories"), api("/api/manufacturers"), api("/api/location-types"), api("/api/locations")]).then(([auth, c, brands, types, locs]) => {
      setMe(auth.user);
      setCategories(c.items || []);
      setManufacturers(brands.items || []);
      setLocationTypes(types.items || []);
      setLocations(locs.items || []);
    });
  }, []);

  useEffect(() => {
    let qValue = params.get("q") || "";
    let filterValue = filtersFromParams(params);
    let sortValue = sortFromParams(params);
    if (!hasEstoqueListQuery(qValue, filterValue, sortValue)) {
      const stored = readEstoqueListState();
      if (hasEstoqueListQuery(stored.q, stored.filters, stored.sort)) {
        qValue = stored.q;
        filterValue = stored.filters;
        sortValue = stored.sort;
        setQ(qValue);
        setFilters(filterValue);
        setSort(sortValue);
        if (hasAdvancedFilters(filterValue)) setMoreFiltersOpen(true);
        router.replace(estoqueListPath(qValue, filterValue, sortValue));
      }
    } else if (hasAdvancedFilters(filterValue)) {
      setMoreFiltersOpen(true);
    }
    void fetchPage(1, { qValue, filterValue, sortValue });
    // Carga inicial: URL, ou últimos filtros da sessão se a listagem vier limpa.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const allVisibleSelected = data.items.length > 0 && data.items.every((item) => selected.has(item.id));
  const hasMore = data.items.length < data.total;
  const canTransfer = me ? can(me, PERMISSIONS.STOCK_TRANSFER) : false;
  const canTrash = me ? can(me, PERMISSIONS.PRODUCT_TRASH) : false;
  const canImportPrices = me ? can(me, PERMISSIONS.PRICE_IMPORT) : false;

  function searchNow(qValue, filterValue) {
    const nextQ = qValue !== undefined ? qValue : q;
    const nextFilters = filterValue || filters;
    if (qValue !== undefined) setQ(qValue);
    if (filterValue) setFilters(filterValue);
    router.replace(estoqueListPath(nextQ, nextFilters, sort));
    void fetchPage(1, { qValue: nextQ, filterValue: nextFilters, sortValue: sort });
  }

  const categoryOptions = useMemo(
    () => categories.map((item) => ({ value: item.id, label: item.name })),
    [categories],
  );
  const manufacturerOptions = useMemo(
    () => manufacturers.map((item) => ({ value: item.id, label: item.name })),
    [manufacturers],
  );
  const conditionOptions = useMemo(
    () => Object.entries(CONDITION_LABELS).map(([value, label]) => ({ value, label })),
    [],
  );
  const statusOptions = useMemo(
    () => Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label })),
    [],
  );
  const voltageOptions = useMemo(
    () => Object.entries(VOLTAGE_LABELS).map(([value, label]) => ({ value, label })),
    [],
  );
  const locationTypeOptions = useMemo(
    () => locationTypes.map((item) => ({ value: item.id, label: item.name })),
    [locationTypes],
  );
  const locationOptions = useMemo(
    () => locations
      .filter((item) => parseFilterList(filters.locationTypeId).includes(String(item.locationTypeId)))
      .map((item) => ({ value: item.id, label: item.name })),
    [locations, filters.locationTypeId],
  );

  const filterChips = useMemo(() => {
    const chips = [];
    if (String(applied.q || "").trim()) {
      chips.push({ key: "q", label: `Busca: ${applied.q}`, clear: () => ({ q: "", filters: applied.filters }) });
    }
    const f = applied.filters || EMPTY_FILTERS;
    if (f.categoryId) {
      chips.push({
        key: "categoryId",
        label: `Categoria: ${multiLabel(f.categoryId, categoryOptions, "—")}`,
        clear: () => ({ q: applied.q, filters: { ...f, categoryId: "" } }),
      });
    }
    if (f.manufacturerId) {
      chips.push({
        key: "manufacturerId",
        label: `Fabricante: ${multiLabel(f.manufacturerId, manufacturerOptions, "—")}`,
        clear: () => ({ q: applied.q, filters: { ...f, manufacturerId: "" } }),
      });
    }
    if (f.status) {
      chips.push({
        key: "status",
        label: `Status: ${multiLabel(f.status, statusOptions, "—")}`,
        clear: () => ({ q: applied.q, filters: { ...f, status: "" } }),
      });
    }
    if (f.condition) {
      chips.push({
        key: "condition",
        label: `Condição: ${multiLabel(f.condition, conditionOptions, "—")}`,
        clear: () => ({ q: applied.q, filters: { ...f, condition: "" } }),
      });
    }
    if (f.voltage) {
      chips.push({
        key: "voltage",
        label: `Tensão: ${multiLabel(f.voltage, voltageOptions, "—")}`,
        clear: () => ({ q: applied.q, filters: { ...f, voltage: "" } }),
      });
    }
    if (f.commercialPhoto === "with") {
      chips.push({ key: "commercialPhoto", label: "Com foto comercial", clear: () => ({ q: applied.q, filters: { ...f, commercialPhoto: "" } }) });
    }
    if (f.commercialPhoto === "without") {
      chips.push({ key: "commercialPhoto", label: "Sem foto comercial", clear: () => ({ q: applied.q, filters: { ...f, commercialPhoto: "" } }) });
    }
    if (f.minPrice) {
      chips.push({ key: "minPrice", label: `Preço mín.: ${f.minPrice}`, clear: () => ({ q: applied.q, filters: { ...f, minPrice: "" } }) });
    }
    if (f.maxPrice) {
      chips.push({ key: "maxPrice", label: `Preço máx.: ${f.maxPrice}`, clear: () => ({ q: applied.q, filters: { ...f, maxPrice: "" } }) });
    }
    if (f.from) {
      chips.push({ key: "from", label: `Entrada: ${formatDate(f.from)}`, clear: () => ({ q: applied.q, filters: { ...f, from: "" } }) });
    }
    if (f.priceUpdatedOn) {
      chips.push({
        key: "priceUpdatedOn",
        label: `Preço atualizado: ${formatDate(f.priceUpdatedOn)}`,
        clear: () => ({ q: applied.q, filters: { ...f, priceUpdatedOn: "" } }),
      });
    }
    if (f.stalePriceDays) {
      const stale = PRICE_STALE_DAYS.find((item) => item.value === f.stalePriceDays)?.label || f.stalePriceDays;
      chips.push({
        key: "stalePriceDays",
        label: `Desatualizado: ${stale}`,
        clear: () => ({ q: applied.q, filters: { ...f, stalePriceDays: "" } }),
      });
    }
    if (f.locationTypeId) {
      chips.push({
        key: "locationTypeId",
        label: `Tipo local: ${multiLabel(f.locationTypeId, locationTypeOptions, "—")}`,
        clear: () => ({ q: applied.q, filters: { ...f, locationTypeId: "", locationId: "" } }),
      });
    }
    if (f.locationId) {
      const allLocations = locations.map((item) => ({ value: item.id, label: item.name }));
      chips.push({
        key: "locationId",
        label: `Local: ${multiLabel(f.locationId, allLocations, "—")}`,
        clear: () => ({ q: applied.q, filters: { ...f, locationId: "" } }),
      });
    }
    return chips;
  }, [
    applied,
    categoryOptions,
    manufacturerOptions,
    statusOptions,
    conditionOptions,
    voltageOptions,
    locationTypeOptions,
    locations,
  ]);

  function clearAllFilters() {
    setQ("");
    setFilters(EMPTY_FILTERS);
    setSort(EMPTY_ESTOQUE_SORT);
    setMoreFiltersOpen(false);
    clearEstoqueListState();
    router.replace("/estoque");
    void fetchPage(1, { qValue: "", filterValue: EMPTY_FILTERS, sortValue: EMPTY_ESTOQUE_SORT });
  }

  function removeChip(chip) {
    const next = chip.clear();
    searchNow(next.q, next.filters);
  }

  function sortBy(key) {
    const next = {
      sort: key,
      dir: sort.sort === key && sort.dir === "asc" ? "desc" : "asc",
    };
    setSort(next);
    router.replace(estoqueListPath(applied.q, applied.filters, next));
    void fetchPage(1, { qValue: applied.q, filterValue: applied.filters, sortValue: next });
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
    if (ids.length > MAX_TRANSFER_BATCH) {
      toast.error(`Selecione no máximo ${MAX_TRANSFER_BATCH} produtos por lote.`);
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
      await fetchPage(1, { qValue: applied.q, filterValue: applied.filters, sortValue: applied.sort });
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
              <PriceImportButton onApplied={() => void fetchPage(1, { qValue: applied.q, filterValue: applied.filters, sortValue: applied.sort })} />
            ) : null}
            <Link href="/entrada">
              <Button>Nova entrada</Button>
            </Link>
          </>
        }
      />

      <Card className="mb-4 space-y-4">
        <ScanField
          value={q}
          onChange={setQ}
          onScan={(parsed) => {
            const text = parsed.query ?? parsed.raw ?? "";
            searchNow(text);
          }}
          placeholder="ID, Serial Onyx, EAN, model code, categoria..."
        />

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Field label="Categoria">
            <MultiSelect
              placeholder="Todas as categorias"
              emptyLabel="Todas as categorias"
              value={filters.categoryId}
              onChange={(categoryId) => setFilters({ ...filters, categoryId })}
              options={categoryOptions}
            />
          </Field>
          <Field label="Fabricante">
            <MultiSelect
              placeholder="Todos os fabricantes"
              emptyLabel="Todos os fabricantes"
              value={filters.manufacturerId}
              onChange={(manufacturerId) => setFilters({ ...filters, manufacturerId })}
              options={manufacturerOptions}
            />
          </Field>
          <Field label="Status">
            <MultiSelect
              placeholder="Todos os status"
              emptyLabel="Todos os status"
              value={filters.status}
              onChange={(status) => setFilters({ ...filters, status })}
              options={statusOptions}
            />
          </Field>
          <Field label="Condição">
            <MultiSelect
              placeholder="Todas as condições"
              emptyLabel="Todas as condições"
              value={filters.condition}
              onChange={(condition) => setFilters({ ...filters, condition })}
              options={conditionOptions}
            />
          </Field>
        </div>

        {filterChips.length ? (
          <div className="flex flex-wrap gap-2">
            {filterChips.map((chip) => (
              <button
                key={chip.key}
                type="button"
                onClick={() => removeChip(chip)}
                className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-border bg-surface-2 px-2.5 py-1 text-xs text-muted hover:border-accent/40 hover:text-text"
              >
                <span className="truncate">{chip.label}</span>
                <span className="text-accent" aria-hidden>×</span>
              </button>
            ))}
          </div>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => setMoreFiltersOpen((open) => !open)}
            className="gap-1.5"
          >
            {moreFiltersOpen ? "Ocultar filtros" : "Mais filtros"}
            <ChevronDown className={cn("h-4 w-4 transition", moreFiltersOpen ? "rotate-180" : "")} />
            {hasAdvancedFilters(filters) && !moreFiltersOpen ? (
              <span className="rounded-full bg-accent/15 px-1.5 py-0.5 text-[10px] font-semibold text-accent">ativo</span>
            ) : null}
          </Button>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" onClick={clearAllFilters} disabled={loading}>
              Limpar filtros
            </Button>
            <Button type="button" onClick={() => searchNow()} disabled={loading}>
              {loading ? "Buscando..." : "Buscar"}
            </Button>
          </div>
        </div>

        {moreFiltersOpen ? (
          <div className="space-y-4 border-t border-border pt-4">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Preço</p>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <Field label="Preço mín.">
                  <Input type="number" min="0" step="0.01" value={filters.minPrice} onChange={(e) => setFilters({ ...filters, minPrice: e.target.value })} />
                </Field>
                <Field label="Preço máx.">
                  <Input type="number" min="0" step="0.01" value={filters.maxPrice} onChange={(e) => setFilters({ ...filters, maxPrice: e.target.value })} />
                </Field>
                <Field label="Preço atualizado em">
                  <Input type="date" value={filters.priceUpdatedOn} onChange={(e) => setFilters({ ...filters, priceUpdatedOn: e.target.value })} />
                </Field>
                <Field label="Preço desatualizado">
                  <Select value={filters.stalePriceDays} onChange={(e) => setFilters({ ...filters, stalePriceDays: e.target.value })}>
                    <option value="">Qualquer</option>
                    {PRICE_STALE_DAYS.map((item) => (
                      <option key={item.value} value={item.value}>{item.label}</option>
                    ))}
                  </Select>
                </Field>
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Localização</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Tipo de localização">
                  <MultiSelect
                    placeholder="Todos os tipos"
                    emptyLabel="Todos os tipos"
                    value={filters.locationTypeId}
                    onChange={(locationTypeId) => {
                      const typeIds = new Set(parseFilterList(locationTypeId));
                      const allowed = new Set(
                        locations.filter((item) => typeIds.has(String(item.locationTypeId))).map((item) => String(item.id)),
                      );
                      const locationId = parseFilterList(filters.locationId).filter((id) => allowed.has(id)).join(",");
                      setFilters({ ...filters, locationTypeId, locationId });
                    }}
                    options={locationTypeOptions}
                  />
                </Field>
                <Field label="Localização">
                  <MultiSelect
                    placeholder={filters.locationTypeId ? "Todas as localizações" : "Selecione o tipo"}
                    emptyLabel="Todas as localizações"
                    value={filters.locationId}
                    onChange={(locationId) => setFilters({ ...filters, locationId })}
                    disabled={!filters.locationTypeId}
                    options={locationOptions}
                  />
                </Field>
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Outros</p>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                <Field label="Tensão">
                  <MultiSelect
                    placeholder="Todas as tensões"
                    emptyLabel="Todas as tensões"
                    value={filters.voltage}
                    onChange={(voltage) => setFilters({ ...filters, voltage })}
                    options={voltageOptions}
                  />
                </Field>
                <Field label="Foto comercial">
                  <Select value={filters.commercialPhoto || ""} onChange={(e) => setFilters({ ...filters, commercialPhoto: e.target.value })}>
                    <option value="">Qualquer</option>
                    <option value="with">Com foto comercial</option>
                    <option value="without">Sem foto comercial</option>
                  </Select>
                </Field>
                <Field label="Entrada a partir de">
                  <Input type="date" value={filters.from} onChange={(e) => setFilters({ ...filters, from: e.target.value })} />
                </Field>
              </div>
            </div>
          </div>
        ) : null}
      </Card>

      {data.items.length ? (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <button type="button" className="text-sm text-accent" onClick={() => toggleVisible(!allVisibleSelected)}>
            {allVisibleSelected ? "Limpar seleção visível" : "Selecionar visíveis"}
          </button>
          {selected.size ? (
            <p className="text-xs text-muted">{selected.size} selecionado(s)</p>
          ) : null}
        </div>
      ) : null}

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
                  <p className="text-xs text-muted">{item.catalogModel?.commercialImages?.length ? "Com foto comercial" : "Sem foto comercial"}</p>
                  <p className="text-xs text-muted">
                    {item.serialOnyx} · {item.category?.name}
                    {item.voltage ? ` · ${item.voltage}` : ""}
                    {item.locationPath ? ` · ${item.locationPath}` : ""}
                  </p>
                  <div className="flex items-center justify-between">
                    <ConditionBadge condition={item.condition} />
                    <span className="text-sm font-semibold">{formatCurrency(item.cashPrice)}</span>
                  </div>
                  {item.status === STATUSES.SOLD ? (
                    <p className="text-xs text-muted">Valor vendido {item.soldPrice == null ? "—" : formatCurrency(item.soldPrice)}</p>
                  ) : null}
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
          <table className="w-full min-w-[1280px] text-left text-sm">
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
                {TABLE_COLUMNS.map((column) => (
                  <th key={column.key} className="whitespace-nowrap px-3 py-3">
                    <SortHeader column={column} sortState={sort} onSort={sortBy} />
                  </th>
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
                  <td className="px-3 py-2">
                    {item.catalogModel?.commercialImages?.[0]?.fileUrl ? (
                      <img src={item.catalogModel.commercialImages[0].fileUrl} alt="" className="h-10 w-10 rounded-lg object-cover" />
                    ) : (
                      <span className="text-xs text-muted">Sem foto</span>
                    )}
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
                  <td className="px-3 py-2">{item.status === STATUSES.SOLD && item.soldPrice != null ? formatCurrency(item.soldPrice) : "—"}</td>
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
              onClick={() => void fetchPage(page + 1, { append: true, qValue: applied.q, filterValue: applied.filters, sortValue: applied.sort })}
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
      ? `${item.openSaleOrder.number} · em negociação`
      : item.openSaleOrder.number;
  }
  return item.openSaleOrder.reservedUntil ? "Reservado em outra venda" : "Em outra venda";
}
