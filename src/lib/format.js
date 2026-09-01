const currency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const dateTime = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
});

const dateOnly = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
});

export function formatCurrency(value) {
  return currency.format(Number(value || 0));
}

export function formatDateTime(value) {
  if (!value) return "—";
  return dateTime.format(new Date(value));
}

export function formatDate(value) {
  if (!value) return "—";
  return dateOnly.format(new Date(value));
}

export function formatProductId(id) {
  return `#${String(id).padStart(5, "0")}`;
}

export function formatFileSize(bytes) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}

export function periodRange(period, from, to) {
  const now = new Date();
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);

  if (period === "custom" && from && to) {
    const start = new Date(from);
    start.setHours(0, 0, 0, 0);
    const customEnd = new Date(to);
    customEnd.setHours(23, 59, 59, 999);
    return { start, end: customEnd };
  }

  const start = new Date(now);
  start.setHours(0, 0, 0, 0);

  if (period === "today") return { start, end };
  const days = period === "7d" ? 7 : period === "90d" ? 90 : 30;
  start.setDate(start.getDate() - (days - 1));
  return { start, end };
}
