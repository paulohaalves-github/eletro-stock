export function parseFilterList(value) {
  return [...new Set(String(value || "").split(/[,\s]+/).map((item) => item.trim()).filter(Boolean))];
}

export function parseNumericFilterList(value) {
  return parseFilterList(value).map(Number).filter((id) => Number.isInteger(id) && id > 0);
}

export function toggleFilterValue(current, nextValue) {
  const key = String(nextValue);
  const selected = parseFilterList(current);
  const next = selected.includes(key) ? selected.filter((item) => item !== key) : [...selected, key];
  return next.join(",");
}
