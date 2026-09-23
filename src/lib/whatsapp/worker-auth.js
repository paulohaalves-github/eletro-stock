import { timingSafeEqual } from "crypto";
import { unauthorized } from "../errors";

function safeEqual(left, right) {
  const a = Buffer.from(String(left || ""));
  const b = Buffer.from(String(right || ""));
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function assertWorkerSecret(request) {
  const expected = process.env.WHATSAPP_WORKER_SECRET;
  if (!expected) throw unauthorized("Worker do WhatsApp não configurado.");
  const provided = request.headers.get("x-worker-secret") || "";
  if (!safeEqual(provided, expected)) throw unauthorized("Segredo do worker inválido.");
}
