import { LIST_PAGE_SIZE } from "./constants";

export const LIST_PAGE_SIZE_MAX = 200;

export function parsePagination(filters = {}, { defaultAll = false } = {}) {
  const raw = filters.pageSize;
  const hasPageSize = raw != null && raw !== "";
  if (defaultAll && !hasPageSize) {
    return { skip: undefined, take: undefined, page: 1, pageSize: null, paginated: false };
  }
  const pageSize = Math.min(Number(raw) || LIST_PAGE_SIZE, LIST_PAGE_SIZE_MAX);
  const page = Math.max(Number(filters.page) || 1, 1);
  return {
    skip: (page - 1) * pageSize,
    take: pageSize,
    page,
    pageSize,
    paginated: true,
  };
}

export function paginationResult(items, total, pagination) {
  return {
    items,
    total,
    page: pagination.page,
    pageSize: pagination.paginated ? pagination.pageSize : items.length,
  };
}

export function listQuery(filters, page, pageSize = LIST_PAGE_SIZE) {
  const search = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
  });
  for (const [key, value] of Object.entries(filters || {})) {
    if (value != null && value !== "") search.set(key, String(value));
  }
  return search.toString();
}
