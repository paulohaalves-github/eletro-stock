/**
 * Camada de leitura de códigos — preparada para câmera (EAN, QR e código interno).
 * A UI consome esta API; o motor de câmera pode ser plugado sem reescrever o sistema.
 */

export const CODE_TYPES = {
  EAN: "EAN",
  QR: "QR",
  INTERNAL: "INTERNAL",
  SERIAL_ONYX: "SERIAL_ONYX",
  MODEL: "MODEL",
  UNKNOWN: "UNKNOWN",
};

export function normalizeCode(raw) {
  return String(raw || "")
    .trim()
    .replace(/\s+/g, " ");
}

export function detectCodeType(raw) {
  const value = normalizeCode(raw);
  if (!value) return CODE_TYPES.UNKNOWN;
  if (/^ES-\d+$/i.test(value) || /^#?\d{1,8}$/.test(value)) return CODE_TYPES.INTERNAL;
  if (/^\d{8}$/.test(value) || /^\d{12,14}$/.test(value)) return CODE_TYPES.EAN;
  if (/^SN/i.test(value) || /^ONYX/i.test(value)) return CODE_TYPES.SERIAL_ONYX;
  if (/^QR:/i.test(value) || value.startsWith("http")) return CODE_TYPES.QR;
  return CODE_TYPES.UNKNOWN;
}

export function toSearchQuery(raw) {
  const value = normalizeCode(raw).replace(/^#/, "").replace(/^QR:/i, "");
  return value;
}

export function parseQrPayload(raw) {
  const value = normalizeCode(raw);
  try {
    const url = new URL(value);
    const id = url.searchParams.get("id") || url.pathname.split("/").pop();
    return { type: CODE_TYPES.QR, productId: id, query: id };
  } catch {
    return { type: detectCodeType(value), query: toSearchQuery(value) };
  }
}

/**
 * Interface futura do leitor de câmera.
 * Implementações reais devem chamar onScan({ raw, type, query }).
 */
export function createScannerAdapter({ onScan, onError } = {}) {
  return {
    supported: typeof window !== "undefined" && "BarcodeDetector" in window,
    async start() {
      if (typeof window === "undefined" || !("BarcodeDetector" in window)) {
        onError?.(new Error("Leitor de câmera ainda não disponível neste dispositivo."));
        return null;
      }
      const detector = new window.BarcodeDetector({
        formats: ["ean_13", "ean_8", "qr_code", "code_128", "upc_a"],
      });
      return detector;
    },
    emit(raw) {
      const parsed = parseQrPayload(raw);
      onScan?.(parsed);
    },
  };
}
