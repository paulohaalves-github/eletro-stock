import { CONDITIONS } from "./constants";
import { validationError } from "./errors";

export function emptyToNull(value) {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text.length ? text : null;
}

export function toNumber(value, fallback = 0) {
  if (value === undefined || value === null || value === "") return fallback;
  const parsed = Number(String(value).replace(",", "."));
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function parseId(value) {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    throw validationError("Identificador inválido.");
  }
  return id;
}

export function validateProductPayload(payload, { partial = false } = {}) {
  const data = {};

  if (!partial || payload.serialOnyx !== undefined) {
    data.serialOnyx = emptyToNull(payload.serialOnyx);
    if (!partial && !data.serialOnyx) {
      throw validationError("Informe o Serial Onyx.");
    }
  }
  if (!partial || payload.supplierModelCode !== undefined) {
    data.supplierModelCode = emptyToNull(payload.supplierModelCode);
  }
  if (!partial || payload.commercialName !== undefined) {
    data.commercialName = emptyToNull(payload.commercialName);
  }
  if (!partial || payload.ean !== undefined) {
    data.ean = emptyToNull(payload.ean);
  }
  if (!partial || payload.lineId !== undefined) {
    data.lineId = payload.lineId ? Number(payload.lineId) : null;
  }
  if (!partial || payload.categoryId !== undefined) {
    data.categoryId = payload.categoryId ? Number(payload.categoryId) : null;
    if (!partial && !data.categoryId) {
      throw validationError("Informe a categoria.");
    }
  }
  if (!partial || payload.capacitySizeType !== undefined) {
    data.capacitySizeType = emptyToNull(payload.capacitySizeType);
  }
  if (!partial || payload.condition !== undefined) {
    data.condition = emptyToNull(payload.condition);
    if (!partial && !data.condition) {
      throw validationError("Informe a condição do produto.");
    }
    if (data.condition && !Object.values(CONDITIONS).includes(data.condition)) {
      throw validationError("Condição inválida.");
    }
  }
  if (!partial || payload.damageDescription !== undefined) {
    data.damageDescription = emptyToNull(payload.damageDescription);
  }
  if (!partial || payload.description !== undefined) {
    data.description = emptyToNull(payload.description);
  }
  if (!partial || payload.installmentPrice !== undefined) {
    data.installmentPrice = toNumber(payload.installmentPrice, 0);
    if (data.installmentPrice < 0) throw validationError("Preço parcelado inválido.");
  }
  if (!partial || payload.cashPrice !== undefined) {
    data.cashPrice = toNumber(payload.cashPrice, 0);
    if (data.cashPrice < 0) throw validationError("Preço à vista inválido.");
  }
  if (!partial || payload.marketPrice !== undefined) {
    data.marketPrice = toNumber(payload.marketPrice, 0);
    if (data.marketPrice < 0) throw validationError("Preço de mercado inválido.");
  }
  if (!partial || payload.origin !== undefined) {
    data.origin = emptyToNull(payload.origin);
  }

  const condition = data.condition;
  if (condition === CONDITIONS.NEW_DAMAGE && !data.damageDescription) {
    throw validationError("Preencha a descrição da avaria.");
  }

  return data;
}
