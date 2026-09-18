import { warrantyExpiresAt } from "./constants";

const currency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const dateTime = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const dateOnly = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
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

function describeRemaining(from, to) {
  let months = (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
  let days = to.getDate() - from.getDate();
  if (days < 0) {
    months -= 1;
    days += new Date(to.getFullYear(), to.getMonth(), 0).getDate();
  }
  if (months < 0) return "";
  const parts = [];
  if (months > 0) parts.push(months === 1 ? "1 mês" : `${months} meses`);
  if (days > 0) parts.push(days === 1 ? "1 dia" : `${days} dias`);
  return parts.join(" e ");
}

export function formatWarrantyRemaining(soldAt, months, at = new Date()) {
  if (!soldAt || months == null || months === "") return null;
  const expiresAt = warrantyExpiresAt(soldAt, Number(months));
  if (Number.isNaN(expiresAt.getTime())) return null;
  if (expiresAt < at) {
    return `Garantia vencida em ${formatDate(expiresAt)}`;
  }
  const remaining = describeRemaining(at, expiresAt);
  if (!remaining) return `Vence hoje (${formatDate(expiresAt)})`;
  return `Restam ${remaining} de garantia · vence em ${formatDate(expiresAt)}`;
}

export function formatProductId(id) {
  return `#${String(id).padStart(5, "0")}`;
}

export function formatLocationPath(location) {
  if (!location) return null;
  const typeName = location.locationType?.name;
  if (!typeName) return location.name || null;
  return `${typeName} → ${location.name}`;
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
