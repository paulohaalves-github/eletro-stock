import { validationError } from "../errors";
import { getIcecatSettings } from "./settings";

const IMAGE_HOST = /(^|\.)icecat\.biz$/i;

function textValue(value) {
  if (typeof value === "string") return value;
  if (value && typeof value === "object") return value.Value || value.Name || value.BrandName || "";
  return "";
}

function plainText(value) {
  return String(value || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function featureLines(data) {
  const groups = data?.FeaturesGroups || data?.FeatureGroups || [];
  if (!Array.isArray(groups)) return "";
  const lines = [];
  for (const group of groups) {
    const features = group?.Features || [];
    if (!Array.isArray(features)) continue;
    for (const feature of features) {
      const name = textValue(feature?.Feature?.Name) || textValue(feature?.Name);
      const value = textValue(feature?.PresentationValue) || textValue(feature?.RawValue) || textValue(feature?.Value);
      if (name && value) lines.push(`${name}: ${value}`);
    }
  }
  return lines.join("\n");
}

function imageUrls(data) {
  const urls = [];
  const push = (value) => {
    const url = textValue(value);
    if (url.startsWith("https://")) urls.push(url);
  };
  push(data?.Image?.HighPic);
  push(data?.Image?.Pic500x500);
  const gallery = data?.Gallery || data?.ProductGallery || [];
  if (Array.isArray(gallery)) {
    for (const item of gallery) push(item?.Pic500x500 || item?.Pic || item?.LowPic);
  }
  return [...new Set(urls)].slice(0, 8);
}

function parseIcecat(payload) {
  const data = payload?.data || {};
  const general = data.GeneralInfo || {};
  const brand = textValue(general.Brand) || textValue(general.BrandInfo?.BrandName);
  const description = plainText(
    textValue(general.Description?.LongDesc)
    || textValue(general.SummaryDescription?.LongSummaryDescription)
    || textValue(data.Description?.LongDesc)
    || featureLines(data),
  );
  return {
    manufacturer: String(brand || "").trim().slice(0, 160),
    specifications: description.slice(0, 12000),
    imageUrls: imageUrls(data),
  };
}

export function assertIcecatImageUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw validationError("Endereço de imagem do Icecat inválido.");
  }
  if (url.protocol !== "https:" || !IMAGE_HOST.test(url.hostname)) {
    throw validationError("Endereço de imagem do Icecat inválido.");
  }
  return url;
}

const ICECAT_ERRORS = {
  3: "O usuário do Icecat não foi reconhecido. Use o nome que aparece no topo do My Profile, não o e-mail.",
  9: "Este produto não faz parte do catálogo gratuito do Icecat.",
  14: "A marca restringe esta ficha no Icecat.",
  15: "A ficha deste produto ainda não foi publicada no Icecat.",
  18: "A chave não foi reconhecida. Em Access Tokens, copie o API Access Token, não o Content Token.",
  19: "A chave de acesso está incompleta. Copie o API Access Token de novo, sem aspas ou espaços.",
};

const MISS_CODES = new Set([4, 8, 16]);

function icecatFailure(payload) {
  const code = Number(payload?.StatusCode ?? payload?.statusCode);
  if (ICECAT_ERRORS[code]) return ICECAT_ERRORS[code];
  if (code === 18 || code === 19 || code === 1 || code === 5 || code === 7) {
    return "O Icecat não aceitou a consulta. Confira o usuário e a chave em Configurações.";
  }
  return "O Icecat não concluiu a consulta.";
}

function missingMessage(triedEan, triedCode) {
  if (triedEan && triedCode) {
    return "O Icecat não encontrou uma ficha para este EAN nem para esta marca e Model Code.";
  }
  if (triedCode) return "O Icecat não encontrou uma ficha para esta marca e este Model Code.";
  return "O Icecat não encontrou uma ficha para este EAN.";
}

async function requestIcecat(settings, { lang, params }) {
  const url = new URL("https://live.icecat.biz/api");
  url.searchParams.set("lang", lang);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);

  let response;
  try {
    response = await fetch(url, {
      headers: {
        "api-token": settings.apiToken,
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(20000),
    });
  } catch {
    return { kind: "network" };
  }

  const payload = await response.json().catch(() => null);
  if (!payload) return { kind: "reject" };
  const code = Number(payload.StatusCode ?? payload.statusCode);
  if (MISS_CODES.has(code) || code === 2) return { kind: "miss" };
  if (!response.ok || (payload.msg && payload.msg !== "OK" && !payload.data)) {
    return { kind: "error", message: icecatFailure(payload) };
  }
  const sheet = parseIcecat(payload);
  if (!sheet.manufacturer && !sheet.specifications && !sheet.imageUrls.length) return { kind: "miss" };
  return { kind: "ok", sheet };
}

export async function lookupIcecat({ ean, brand, productCode } = {}) {
  const settings = await getIcecatSettings();
  if (!settings.configured) {
    throw validationError("Configure o usuário e a chave do Icecat em Administrador > Configurações.");
  }

  const digits = String(ean || "").replace(/\D/g, "");
  const gtin = digits.length >= 8 && digits.length <= 14 ? digits : "";
  const vendor = String(brand || "").trim();
  const code = String(productCode || "").trim().toUpperCase();
  const triedCode = Boolean(vendor && code);

  if (!gtin && !code) {
    throw validationError("Informe o EAN ou o Model Code para consultar o Icecat.");
  }
  if (!gtin && code && !vendor) {
    throw validationError("Para buscar pelo Model Code, preencha o fabricante com a marca do Icecat, por exemplo Samsung.");
  }
  if (ean && !gtin && !triedCode) {
    throw validationError("Informe um EAN válido para consultar o Icecat.");
  }

  const queries = [];
  for (const lang of ["PT", "EN"]) {
    if (gtin) queries.push({ lang, params: { GTIN: gtin } });
    if (triedCode) queries.push({ lang, params: { Brand: vendor, ProductCode: code } });
  }

  for (const query of queries) {
    const result = await requestIcecat(settings, query);
    if (result.kind === "ok") return result.sheet;
    if (result.kind === "network") {
      throw validationError("Não foi possível consultar o Icecat agora. Tente de novo em instantes.");
    }
    if (result.kind === "reject") {
      throw validationError("O Icecat não aceitou a consulta. Confira o usuário e a chave em Configurações.");
    }
    if (result.kind === "error") throw validationError(result.message);
  }

  if (gtin && code && !vendor) {
    throw validationError("O Icecat não encontrou este EAN. Para tentar pelo Model Code, preencha o fabricante com a marca.");
  }
  throw validationError(missingMessage(Boolean(gtin), triedCode));
}
