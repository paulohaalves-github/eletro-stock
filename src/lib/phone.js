export function digitsOnly(phone) {
  return String(phone || "").replace(/\D/g, "");
}

export function normalizeWhatsAppPhone(phone) {
  let digits = digitsOnly(phone);
  if (!digits) return "";
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("55") && digits.length >= 12) return digits;
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  return digits;
}

export function phoneMatchVariants(phone) {
  const normalized = normalizeWhatsAppPhone(phone);
  const variants = new Set([normalized, digitsOnly(phone)].filter(Boolean));
  if (normalized.startsWith("55") && normalized.length === 13) {
    variants.add(`${normalized.slice(0, 4)}${normalized.slice(5)}`);
  }
  if (normalized.startsWith("55") && normalized.length === 12) {
    variants.add(`${normalized.slice(0, 4)}9${normalized.slice(4)}`);
  }
  return [...variants];
}

export function formatPhone(phone) {
  const digits = digitsOnly(phone);
  if (!digits) return phone || "—";
  const national = digits.startsWith("55") ? digits.slice(2) : digits;
  if (national.length === 11) {
    return `+55 (${national.slice(0, 2)}) ${national.slice(2, 7)}-${national.slice(7)}`;
  }
  if (national.length === 10) {
    return `+55 (${national.slice(0, 2)}) ${national.slice(2, 6)}-${national.slice(6)}`;
  }
  return `+${digits}`;
}
