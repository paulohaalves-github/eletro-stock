import { lookup } from "node:dns/promises";
import sharp from "sharp";
import { MAX_UPLOAD_BYTES } from "./constants";

const BROWSER_HEADERS = {
  Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
};

function isPrivateIp(ip) {
  const value = String(ip || "").toLowerCase().split("%")[0];
  if (!value) return true;
  if (value.includes(":")) {
    if (value === "::1" || value === "::") return true;
    if (value.startsWith("fe80:") || value.startsWith("fc") || value.startsWith("fd")) return true;
    if (value.startsWith("::ffff:")) return isPrivateIp(value.slice("::ffff:".length));
    return false;
  }
  const parts = value.split(".").map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return true;
  const [a, b] = parts;
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  return false;
}

async function assertPublicHttpsUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error("invalid");
  }
  if (url.protocol !== "https:" || url.username || url.password) throw new Error("invalid");
  const host = url.hostname.toLowerCase();
  if (!host || host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) {
    throw new Error("invalid");
  }
  const records = await lookup(host, { all: true, verbatim: true });
  if (!records.length || records.some((record) => isPrivateIp(record.address))) throw new Error("invalid");
  return url;
}

function looksLikeBadge(url) {
  const value = String(url || "").toLowerCase();
  return /logo|icon|sprite|favicon|badge|pixel|tracking|spacer|1x1|selo|placeholder/.test(value);
}

async function isProductPhoto(bytes) {
  try {
    const meta = await sharp(bytes, { failOn: "error" }).metadata();
    if (!meta.width || !meta.height || meta.format === "svg") return false;
    const longest = Math.max(meta.width, meta.height);
    const shortest = Math.min(meta.width, meta.height);
    if (longest < 700 || shortest < 400) return false;
    if (longest / shortest > 2.2) return false;
    const trimmed = await sharp(bytes).trim({ threshold: 18 }).toBuffer({ resolveWithObject: true });
    const contentLongest = Math.max(trimmed.info.width, trimmed.info.height);
    const contentShortest = Math.min(trimmed.info.width, trimmed.info.height);
    if (contentLongest < 500 || contentShortest < 320) return false;
    return true;
  } catch {
    return false;
  }
}

async function follow(url, headers) {
  let current;
  try {
    current = await assertPublicHttpsUrl(url);
  } catch {
    return null;
  }
  for (let hop = 0; hop < 3; hop += 1) {
    let response;
    try {
      response = await fetch(current, {
        redirect: "manual",
        signal: AbortSignal.timeout(15000),
        headers: { ...headers, Referer: `${current.origin}/` },
      });
    } catch {
      return null;
    }
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) return null;
      try {
        current = await assertPublicHttpsUrl(new URL(location, current).href);
      } catch {
        return null;
      }
      continue;
    }
    if (!response.ok) return null;
    return { response, url: current };
  }
  return null;
}

async function readImage(imageUrl) {
  if (looksLikeBadge(imageUrl)) return null;
  const result = await follow(imageUrl, BROWSER_HEADERS);
  if (!result) return null;
  const type = String(result.response.headers.get("content-type") || "").toLowerCase();
  if (type.includes("text/html") || type.includes("application/json") || type.includes("text/plain") || type.includes("image/svg")) {
    return null;
  }
  const bytes = Buffer.from(await result.response.arrayBuffer());
  if (!bytes.length || bytes.length > MAX_UPLOAD_BYTES) return null;
  if (!(await isProductPhoto(bytes))) return null;
  return bytes;
}

function imageVariants(imageUrl) {
  const variants = [];
  try {
    const url = new URL(imageUrl);
    const host = url.hostname.toLowerCase();
    if (host === "images.samsung.com" || host.endsWith(".images.samsung.com")) {
      const base = `${url.origin}${url.pathname}`;
      variants.push(`${base}?wid=1400&fit=constrain&fmt=png-alpha`);
      variants.push(`${base}?$ORIGIN_PNG$`);
    }
    if (host.includes("mlstatic.com")) {
      variants.push(url.href.replace(/-[IVFC]\.(jpe?g|png|webp)/i, "-O.$1"));
    }
  } catch {
    // o endereço original ainda entra na lista
  }
  variants.push(String(imageUrl || "").split("?")[0]);
  variants.push(imageUrl);
  return [...new Set(variants.filter(Boolean))];
}

export async function downloadPublicImage(imageUrl) {
  for (const variant of imageVariants(imageUrl)) {
    const bytes = await readImage(variant);
    if (bytes) return bytes;
  }
  return null;
}

function metaContent(html, key) {
  const tags = html.match(/<meta\b[^>]*>/gi) || [];
  for (const tag of tags) {
    const attrs = tag.toLowerCase();
    if (!attrs.includes(key)) continue;
    const content = tag.match(/\bcontent\s*=\s*["']([^"']+)["']/i);
    if (content?.[1]) return content[1];
  }
  return "";
}

function enlargeImageUrl(url) {
  const host = url.hostname.toLowerCase();
  if (host === "images.samsung.com" || host.endsWith(".images.samsung.com")) {
    return `${url.origin}${url.pathname}?wid=1400&fit=constrain&fmt=png-alpha`;
  }
  return url.href;
}

function imageKey(url) {
  try {
    const parsed = new URL(url);
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return url;
  }
}

function candidateFrom(value, pageUrl) {
  if (!value || value.startsWith("data:")) return "";
  const raw = String(value).replace(/\\\//g, "/").replace(/&amp;/g, "&").trim();
  try {
    const url = new URL(raw, pageUrl);
    if (url.protocol !== "https:" || looksLikeBadge(url.href)) return "";
    const path = url.pathname.toLowerCase();
    const host = url.hostname.toLowerCase();
    const file = /\.(jpe?g|png|webp)$/i.test(path);
    const gallery = path.includes("/gallery/") || path.includes("/is/image/");
    const known = host === "images.samsung.com" || host.endsWith(".images.samsung.com");
    if (!file && !gallery && !known) return "";
    return enlargeImageUrl(url);
  } catch {
    return "";
  }
}

function pageImageCandidates(html, pageUrl) {
  const found = [];
  const seen = new Set();
  const push = (value) => {
    const href = candidateFrom(value, pageUrl);
    if (!href) return;
    const key = imageKey(href);
    if (seen.has(key)) return;
    seen.add(key);
    found.push(href);
  };
  push(metaContent(html, "og:image"));
  push(metaContent(html, "twitter:image"));
  for (const match of html.matchAll(/\b(?:src|data-src|data-desktop-src|data-original|data-zoom-image)\s*=\s*["']([^"']+)["']/gi)) {
    push(match[1]);
  }
  for (const match of html.matchAll(/https?:\\?\/\\?\/[^"'\\\s<>]+/gi)) push(match[0]);
  return found.slice(0, 12);
}

export async function imageUrlsFromPages(pageUrls) {
  const found = [];
  for (const pageUrl of pageUrls.slice(0, 4)) {
    const result = await follow(pageUrl, {
      ...BROWSER_HEADERS,
      Accept: "text/html,application/xhtml+xml",
    });
    if (!result) continue;
    const type = String(result.response.headers.get("content-type") || "").toLowerCase();
    if (!type.includes("text/html") && !type.includes("application/xhtml")) continue;
    const html = (await result.response.text()).slice(0, 1500000);
    for (const url of pageImageCandidates(html, result.url.href)) {
      if (!found.includes(url)) found.push(url);
      if (found.length >= 12) return found;
    }
  }
  return found;
}
