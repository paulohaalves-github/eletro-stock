import { validationError } from "../errors";
import { getOpenAISettings } from "./settings";

const VOLTAGES = new Set(["110V", "220V", "BIVOLT"]);

function clip(value, max) {
  return String(value || "").replace(/\s+\n/g, "\n").trim().slice(0, max);
}

function asText(value, max) {
  if (Array.isArray(value)) {
    return value.map((item) => {
      if (typeof item === "string") return item.trim();
      if (item && typeof item === "object") {
        const name = item.name || item.label || item.key || "";
        const detail = item.value || item.val || "";
        if (name && detail) return `${name}: ${detail}`;
      }
      return "";
    }).filter(Boolean).join("\n").slice(0, max);
  }
  return clip(value, max);
}

function money(value) {
  if (typeof value === "number") {
    if (!Number.isFinite(value) || value <= 0 || value > 1000000) return null;
    return Math.round(value * 100) / 100;
  }
  let text = String(value ?? "").trim().replace(/[^\d,.-]/g, "");
  if (!text) return null;
  const lastComma = text.lastIndexOf(",");
  const lastDot = text.lastIndexOf(".");
  if (lastComma >= 0 && lastDot >= 0) {
    const decimal = lastComma > lastDot ? "," : ".";
    const thousands = decimal === "," ? "." : ",";
    text = text.replaceAll(thousands, "").replace(decimal, ".");
  } else if (lastComma >= 0) {
    const fraction = text.length - lastComma - 1;
    text = fraction === 2 ? text.replaceAll(".", "").replace(",", ".") : text.replaceAll(",", "");
  } else if ((text.match(/\./g) || []).length > 1) {
    text = text.replaceAll(".", "");
  } else if (lastDot >= 0 && text.length - lastDot - 1 === 3) {
    text = text.replace(".", "");
  }
  const number = Number(text);
  if (!Number.isFinite(number) || number <= 0 || number > 1000000) return null;
  return Math.round(number * 100) / 100;
}

function voltage(value) {
  const text = String(value || "").trim().toUpperCase().replace(/\s+/g, "");
  if (VOLTAGES.has(text)) return text;
  if (text.includes("BIVOLT") || text.includes("BI-VOLT")) return "BIVOLT";
  if (text.startsWith("220") || text.startsWith("240")) return "220V";
  if (text.startsWith("110") || text.startsWith("127")) return "110V";
  return "";
}

function httpsUrl(value) {
  try {
    const url = new URL(String(value || "").trim());
    if (url.protocol !== "https:" || url.username || url.password) return "";
    return url.href;
  } catch {
    return "";
  }
}

function parseJson(text) {
  const raw = String(text || "").trim().replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(raw.slice(start, end + 1));
  } catch {
    return null;
  }
}

function outputText(payload) {
  if (typeof payload?.output_text === "string" && payload.output_text.trim()) return payload.output_text;
  const parts = [];
  for (const item of payload?.output || []) {
    for (const content of item?.content || []) {
      if (typeof content?.text === "string") parts.push(content.text);
    }
  }
  return parts.join("\n");
}

function normalizeSheet(data) {
  const specifications = [asText(data?.description, 4000), asText(data?.specifications, 12000)].filter(Boolean).join("\n\n").slice(0, 12000);
  const imageUrls = [];
  for (const value of Array.isArray(data?.imageUrls) ? data.imageUrls : []) {
    const url = httpsUrl(value);
    if (url && !imageUrls.includes(url)) imageUrls.push(url);
    if (imageUrls.length >= 6) break;
  }
  const sources = [];
  for (const source of Array.isArray(data?.sources) ? data.sources : []) {
    const url = httpsUrl(source?.url || source);
    if (!url) continue;
    sources.push({ title: clip(source?.title, 160) || url, url });
    if (sources.length >= 8) break;
  }
  return {
    commercialName: clip(data?.commercialName, 190),
    manufacturer: clip(data?.manufacturer, 160),
    specifications,
    marketPrice: money(data?.marketPrice),
    priceLow: money(data?.priceLow),
    priceHigh: money(data?.priceHigh),
    voltage: voltage(data?.voltage),
    imageUrls,
    sources,
    notes: clip(data?.notes, 1500),
  };
}

function promptFor(product) {
  return [
    "Pesquise na web a ficha do produto abaixo, vendido no Brasil.",
    "Use somente páginas que falem deste código exato. Não complete com um modelo parecido.",
    "Se não encontrar o código exato, devolva os campos vazios e explique em notes.",
    "Preços são de produto novo, em reais. Não use preço de usado, outlet ou recondicionado.",
    "imageUrls: até 6 endereços https do arquivo da foto do produto inteiro, de preferência .jpg, .png ou .webp do site do fabricante. Não envie logo, ícone, selo, miniatura nem página de anúncio.",
    "Responda somente um JSON com as chaves: manufacturer, commercialName, description, specifications, marketPrice, priceLow, priceHigh, voltage, imageUrls, sources, notes.",
    "specifications é texto puro, uma característica por linha, no formato Nome: valor.",
    "voltage é 110V, 220V, BIVOLT ou null.",
    "marketPrice, priceLow e priceHigh são números ou null.",
    "sources é uma lista de objetos { title, url }.",
    "",
    `Model Code: ${product.productCode || "não informado"}`,
    `EAN: ${product.ean || "não informado"}`,
    `Fabricante conhecido: ${product.brand || "não informado"}`,
    `Nome comercial conhecido: ${product.commercialName || "não informado"}`,
    `Categoria: ${product.category || "não informada"}`,
  ].join("\n");
}

export async function lookupProductWithAi(product) {
  const settings = await getOpenAISettings();
  if (!settings.configured) {
    throw validationError("Configure a chave da consulta por IA em Configurações.");
  }

  let response;
  try {
    response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${settings.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: settings.resolvedModel,
        tools: [{ type: "web_search" }],
        tool_choice: "required",
        max_output_tokens: 2500,
        input: promptFor(product),
      }),
      signal: AbortSignal.timeout(50000),
    });
  } catch {
    throw validationError("Não foi possível consultar a IA agora. Tente de novo em instantes.");
  }

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const code = payload?.error?.code || payload?.error?.type || "";
    if (response.status === 401) throw validationError("A chave da IA não foi aceita. Confira em Configurações.");
    if (response.status === 429) throw validationError("A consulta por IA atingiu o limite. Tente de novo em instantes.");
    if (String(code).includes("model") || response.status === 404) {
      throw validationError("O modelo da IA não aceitou a consulta. Confira o nome do modelo em Configurações.");
    }
    throw validationError("Não foi possível consultar a IA agora. Tente de novo em instantes.");
  }

  const parsed = parseJson(outputText(payload));
  if (!parsed) throw validationError("A consulta por IA não devolveu uma ficha utilizável. Tente de novo.");
  return normalizeSheet(parsed);
}
