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
    if (longest < 320 || shortest < 180) return false;
    if (longest / shortest > 3.2) return false;
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

export async function downloadPublicImage(imageUrl) {
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

function pageImageCandidates(html, pageUrl) {
  const found = [];
  const push = (value, trusted) => {
    if (!value || value.startsWith("data:")) return;
    try {
      const url = new URL(value, pageUrl);
      if (url.protocol !== "https:" || looksLikeBadge(url.href)) return;
      const file = /\.(jpe?g|png|webp)(\?|$)/i.test(url.pathname);
      if (!trusted && !file) return;
      if (!found.includes(url.href)) found.push(url.href);
    } catch {
      // endereço relativo inválido
    }
  };
  push(metaContent(html, "og:image"), true);
  push(metaContent(html, "twitter:image"), true);
  for (const match of html.matchAll(/<img\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi)) push(match[1], false);
  return found.slice(0, 8);
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
    const html = (await result.response.text()).slice(0, 400000);
    for (const url of pageImageCandidates(html, result.url.href)) {
      if (!found.includes(url)) found.push(url);
      if (found.length >= 8) return found;
    }
  }
  return found;
}
