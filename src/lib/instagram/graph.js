import { createHmac, timingSafeEqual } from "node:crypto";
import { readFile } from "node:fs/promises";
import { validationError } from "../errors";
import { resolveUploadPath } from "../services/images";
import { inboxMediaKind } from "../services/inbox-media";

const GRAPH_VERSION = "v23.0";
const GRAPH = `https://graph.facebook.com/${GRAPH_VERSION}`;

export const INSTAGRAM_OAUTH_SCOPES = [
  "pages_show_list",
  "pages_read_engagement",
  "pages_manage_metadata",
  "instagram_basic",
  "instagram_manage_messages",
  "business_management",
].join(",");

export function instagramDialogUrl({ appId, redirectUri, state }) {
  const url = new URL(`https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth`);
  url.searchParams.set("client_id", appId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", INSTAGRAM_OAUTH_SCOPES);
  return url.toString();
}

export function verifyMetaSignature(rawBody, header, appSecret) {
  const received = String(header || "");
  if (!received || !appSecret) return false;
  const expected = `sha256=${createHmac("sha256", appSecret).update(rawBody).digest("hex")}`;
  const left = Buffer.from(expected);
  const right = Buffer.from(received);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

async function readGraphError(response) {
  const data = await response.json().catch(() => ({}));
  return data?.error?.message || data?.error?.error_user_msg || `A Meta respondeu ${response.status}.`;
}

async function graphJson(url, options) {
  const response = await fetch(url, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error?.message || data?.error?.error_user_msg || `A Meta respondeu ${response.status}.`);
  }
  return data;
}

export async function exchangeInstagramCode(settings, code, redirectUri) {
  const shortUrl = new URL(`${GRAPH}/oauth/access_token`);
  shortUrl.searchParams.set("client_id", settings.appId);
  shortUrl.searchParams.set("client_secret", settings.appSecret);
  shortUrl.searchParams.set("redirect_uri", redirectUri);
  shortUrl.searchParams.set("code", code);
  const short = await graphJson(shortUrl);
  if (!short.access_token) throw new Error("A Meta não devolveu o token de acesso.");

  const longUrl = new URL(`${GRAPH}/oauth/access_token`);
  longUrl.searchParams.set("grant_type", "fb_exchange_token");
  longUrl.searchParams.set("client_id", settings.appId);
  longUrl.searchParams.set("client_secret", settings.appSecret);
  longUrl.searchParams.set("fb_exchange_token", short.access_token);
  const long = await graphJson(longUrl);
  return long.access_token || short.access_token;
}

export async function listInstagramAccounts(userToken) {
  const accounts = [];
  let next = `${GRAPH}/me/accounts?fields=id,name,access_token,instagram_business_account{id,username,name}&limit=50&access_token=${encodeURIComponent(userToken)}`;
  for (let page = 0; page < 5 && next; page += 1) {
    const data = await graphJson(next);
    for (const item of data.data || []) {
      const ig = item.instagram_business_account;
      if (!ig?.id || !item.access_token) continue;
      accounts.push({
        pageId: String(item.id),
        pageName: String(item.name || "Página"),
        pageToken: String(item.access_token),
        igUserId: String(ig.id),
        igUsername: String(ig.username || ""),
        igName: String(ig.name || ""),
      });
    }
    next = data.paging?.next || "";
  }
  return accounts;
}

export async function subscribeInstagramPage(pageId, pageToken) {
  const attempts = ["messages,messaging_postbacks,messaging_seen,message_reactions", "messages"];
  let lastError = "Não foi possível inscrever a Página nos webhooks.";
  for (const fields of attempts) {
    const url = `${GRAPH}/${pageId}/subscribed_apps?subscribed_fields=${encodeURIComponent(fields)}&access_token=${encodeURIComponent(pageToken)}`;
    const response = await fetch(url, { method: "POST" });
    if (response.ok) return;
    lastError = await readGraphError(response);
  }
  throw new Error(lastError);
}

export function instagramContactName(profile) {
  const name = String(profile?.name || "").trim();
  const username = String(profile?.username || "").trim();
  if (name && username) return `${name} (@${username})`;
  if (username) return `@${username}`;
  if (name) return name;
  return "Instagram";
}

export async function fetchInstagramProfile(channel, igsid) {
  try {
    const url = `${GRAPH}/${encodeURIComponent(igsid)}?fields=name,username&access_token=${encodeURIComponent(channel.apiKey)}`;
    const data = await graphJson(url);
    return { name: data.name || "", username: data.username || "" };
  } catch (error) {
    console.error("[instagram-profile]", error.message || error);
    return { name: "", username: "" };
  }
}

function instagramAttachmentType(kind) {
  if (kind === "image" || kind === "video" || kind === "audio") return kind;
  return null;
}

async function postInstagramMessage(channel, recipient, message, form) {
  if (!channel.externalId || !channel.apiKey) {
    throw validationError("Conecte a conta do Instagram antes de enviar.");
  }
  const url = `${GRAPH}/${channel.externalId}/messages`;
  const response = form
    ? await fetch(url, { method: "POST", headers: { Authorization: `Bearer ${channel.apiKey}` }, body: form })
    : await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${channel.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ recipient: { id: recipient }, message }),
      });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw validationError(data?.error?.message || "O Instagram recusou o envio da mensagem.");
  }
  return { externalId: data.message_id || null };
}

export async function sendInstagramMessage(channel, { externalContactId, body, media, location, quotedExternalId }) {
  if (location) throw validationError("O Instagram não envia localização.");
  const recipient = String(externalContactId || "").trim();
  if (!recipient) throw validationError("Contato do Instagram sem identificação.");
  const text = String(body || "").trim();
  if (text.length > 1000) {
    throw validationError("O Instagram aceita até 1000 caracteres por mensagem.");
  }
  const reply = quotedExternalId ? { reply_to: { mid: String(quotedExternalId) } } : {};

  if (media?.relativePath) {
    const kind = media.kind || inboxMediaKind(media.mediaType, media.mediaType, media.fileName);
    const type = instagramAttachmentType(kind);
    if (!type) throw validationError("O Instagram Direct aceita imagem, vídeo e áudio. Documentos não são enviados.");
    const bytes = await readFile(resolveUploadPath(media.relativePath));
    const form = new FormData();
    form.append("recipient", JSON.stringify({ id: recipient }));
    form.append("message", JSON.stringify({ attachment: { type, payload: {} }, ...reply }));
    form.append("filedata", new Blob([bytes], { type: media.mimeType || media.mediaType || "application/octet-stream" }), media.fileName || "arquivo");
    const sent = await postInstagramMessage(channel, recipient, null, form);
    if (text) {
      const follow = await postInstagramMessage(channel, recipient, { text, ...reply });
      return { externalId: follow.externalId || sent.externalId };
    }
    return sent;
  }

  if (!text) throw validationError("Escreva a mensagem.");
  return postInstagramMessage(channel, recipient, { text, ...reply });
}
