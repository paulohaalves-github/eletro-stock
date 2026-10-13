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
};

const STORAGE_KEY = "eletro-stock.estoque-list";

export function filtersFromParams(params) {
  const filters = { ...EMPTY_ESTOQUE_FILTERS };
  for (const key of Object.keys(EMPTY_ESTOQUE_FILTERS)) {
    const value = params?.get?.(key);
    if (value) filters[key] = value;
  }
  return filters;
}

export function hasEstoqueListQuery(q, filters) {
  if (String(q || "").trim()) return true;
  return Object.values(filters || {}).some((value) => String(value || "").trim());
}

export function estoqueListPath(q, filters) {
  const search = new URLSearchParams();
  const query = String(q || "").trim();
  if (query) search.set("q", query);
  for (const [key, value] of Object.entries(filters || {})) {
    if (value) search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `/estoque?${qs}` : "/estoque";
}

export function readEstoqueListState() {
  if (typeof window === "undefined") return { q: "", filters: { ...EMPTY_ESTOQUE_FILTERS } };
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return { q: "", filters: { ...EMPTY_ESTOQUE_FILTERS } };
    const parsed = JSON.parse(raw);
    return {
      q: String(parsed?.q || ""),
      filters: { ...EMPTY_ESTOQUE_FILTERS, ...(parsed?.filters || {}) },
    };
  } catch {
    return { q: "", filters: { ...EMPTY_ESTOQUE_FILTERS } };
  }
}

export function writeEstoqueListState(q, filters) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ q: q || "", filters: { ...EMPTY_ESTOQUE_FILTERS, ...(filters || {}) } }));
}

export function clearEstoqueListState() {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(STORAGE_KEY);
}
