/**
 * Pontos de extensão para integrações futuras.
 * Não implementadas agora — a camada de serviços já isola regras de negócio.
 *
 * - ERP / Onyx: sincronizar serial, preços e status
 * - Leitor de código: src/lib/scanner.js + componente ScanField
 * - WhatsApp / Bitrix24 / marketplaces: disparar eventos a partir de writeMovement/writeAudit
 * - Etiquetas QR: ficha de impressão já reserva o ID interno
 */

export const INTEGRATION_EVENTS = {
  PRODUCT_CREATED: "product.created",
  STOCK_ENTRY: "stock.entry",
  STOCK_EXIT: "stock.exit",
  PRODUCT_UPDATED: "product.updated",
};

export function emitIntegrationEvent(_name, _payload) {
  return null;
}
