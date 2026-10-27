export const EMPTY_ESTOQUE_FILTERS = {
  categoryId: "",
  manufacturerId: "",
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
  priceUpdatedOn: "",
  commercialPhoto: "",
};

export const EMPTY_ESTOQUE_SORT = { sort: "", dir: "" };

export const ESTOQUE_SORT_FIELDS = [
  "id",
  "serialOnyx",
  "commercialName",
  "category",
  "locationType",
  "location",
  "supplierModelCode",
  "ean",
  "capacitySizeType",
  "voltage",
  "condition",
  "cashPrice",
  "installmentPrice",
  "lastPriceUpdateAt",
  "status",
  "entryDate",
];

const STORAGE_KEY = "eletro-stock.estoque-list";

export function filtersFromParams(params) {
  const filters = { ...EMPTY_ESTOQUE_FILTERS };
  for (const key of Object.keys(EMPTY_ESTOQUE_FILTERS)) {
    const value = params?.get?.(key);
    if (value) filters[key] = value;
  }
  return filters;
}

export function parseEstoqueSort(sort, dir) {
  const key = String(sort || "");
  if (!ESTOQUE_SORT_FIELDS.includes(key)) return { ...EMPTY_ESTOQUE_SORT };
  return { sort: key, dir: dir === "desc" ? "desc" : "asc" };
}

export function sortFromParams(params) {
  return parseEstoqueSort(params?.get?.("sort"), params?.get?.("dir"));
}

export function hasEstoqueListQuery(q, filters, sortState) {
  if (String(q || "").trim()) return true;
  if (Object.values(filters || {}).some((value) => String(value || "").trim())) return true;
  return Boolean(sortState?.sort);
}

export function estoqueListPath(q, filters, sortState) {
  const search = new URLSearchParams();
  const query = String(q || "").trim();
  if (query) search.set("q", query);
  for (const [key, value] of Object.entries(filters || {})) {
    if (value) search.set(key, String(value));
  }
  if (sortState?.sort) {
    search.set("sort", sortState.sort);
    search.set("dir", sortState.dir === "desc" ? "desc" : "asc");
  }
  const qs = search.toString();
  return qs ? `/estoque?${qs}` : "/estoque";
}

export function readEstoqueListState() {
  const empty = { q: "", filters: { ...EMPTY_ESTOQUE_FILTERS }, sort: { ...EMPTY_ESTOQUE_SORT } };
  if (typeof window === "undefined") return empty;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return empty;
    const parsed = JSON.parse(raw);
    return {
      q: String(parsed?.q || ""),
      filters: { ...EMPTY_ESTOQUE_FILTERS, ...(parsed?.filters || {}) },
      sort: parseEstoqueSort(parsed?.sort?.sort || parsed?.sort, parsed?.sort?.dir || parsed?.dir),
    };
  } catch {
    return empty;
  }
}

export function writeEstoqueListState(q, filters, sortState) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      q: q || "",
      filters: { ...EMPTY_ESTOQUE_FILTERS, ...(filters || {}) },
      sort: parseEstoqueSort(sortState?.sort, sortState?.dir),
    }),
  );
}

export function clearEstoqueListState() {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(STORAGE_KEY);
}
