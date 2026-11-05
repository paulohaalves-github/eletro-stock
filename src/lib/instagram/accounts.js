import { SignJWT, jwtVerify } from "jose";
import { prisma } from "../db";
import { conflict, notFound, validationError } from "../errors";
import { writeAudit } from "../audit";
import { INBOX_CONNECTION_STATUSES, INBOX_PROVIDERS } from "../constants";
import { getInstagramSettings } from "../services/settings";
import { getInboxChannelRecord, publicAppUrl } from "../services/inbox-channels";
import { exchangeInstagramCode, instagramDialogUrl, listInstagramAccounts, subscribeInstagramPage } from "./graph";

function pendingKey(channelId) {
  return `instagram.pending.${Number(channelId)}`;
}

function authSecret() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw validationError("AUTH_SECRET não configurado.");
  return new TextEncoder().encode(secret);
}

export function instagramRedirectUri() {
  const base = publicAppUrl();
  if (!base) throw validationError("Configure APP_URL com o endereço público deste sistema.");
  return `${base}/api/integrations/instagram/callback`;
}

export async function beginInstagramConnect(channelId) {
  const settings = await getInstagramSettings();
  if (!settings.configured) {
    throw validationError("Salve o aplicativo da Meta em Configurações antes de conectar.");
  }
  const channel = await getInboxChannelRecord(channelId);
  if (channel.provider !== INBOX_PROVIDERS.META_INSTAGRAM) {
    throw validationError("Este canal não é do Instagram.");
  }
  if (!channel.active) throw validationError("Ative o canal antes de conectar.");
  const state = await new SignJWT({ purpose: "instagram-oauth", channelId: channel.id })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("15m")
    .sign(authSecret());
  return instagramDialogUrl({
    appId: settings.appId,
    redirectUri: instagramRedirectUri(),
    state,
  });
}

async function readState(state) {
  try {
    const { payload } = await jwtVerify(String(state || ""), authSecret());
    if (payload.purpose !== "instagram-oauth") throw new Error("state");
    const channelId = Number(payload.channelId);
    if (!Number.isInteger(channelId) || channelId <= 0) throw new Error("state");
    return channelId;
  } catch {
    throw validationError("A autorização do Facebook expirou. Conecte de novo.");
  }
}

function publicAccount(account) {
  return {
    pageId: account.pageId,
    pageName: account.pageName,
    igUserId: account.igUserId,
    igUsername: account.igUsername,
    igName: account.igName,
  };
}

export async function storePendingInstagramAccounts(channelId, accounts) {
  await prisma.appSetting.upsert({
    where: { key: pendingKey(channelId) },
    create: { key: pendingKey(channelId), value: JSON.stringify(accounts) },
    update: { value: JSON.stringify(accounts) },
  });
}

async function readPending(channelId) {
  const row = await prisma.appSetting.findUnique({ where: { key: pendingKey(channelId) } });
  if (!row?.value) return [];
  try {
    const parsed = JSON.parse(row.value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function listPendingInstagramAccounts(channelId) {
  const channel = await getInboxChannelRecord(channelId);
  if (channel.provider !== INBOX_PROVIDERS.META_INSTAGRAM) {
    throw validationError("Este canal não é do Instagram.");
  }
  return (await readPending(channelId)).map(publicAccount);
}

export async function finishInstagramOauth(state, code, actor) {
  const channelId = await readState(state);
  const settings = await getInstagramSettings();
  if (!settings.configured) throw validationError("Salve o aplicativo da Meta em Configurações antes de conectar.");
  const token = await exchangeInstagramCode(settings, code, instagramRedirectUri());
  const accounts = await listInstagramAccounts(token);
  if (!accounts.length) {
    throw validationError("Nenhuma conta profissional do Instagram apareceu nas Páginas autorizadas.");
  }
  if (accounts.length === 1) {
    await connectInstagramAccount(channelId, accounts[0], actor);
    return { channelId, connected: true };
  }
  await storePendingInstagramAccounts(channelId, accounts);
  return { channelId, connected: false };
}

async function assertAccountAvailable(channelId, igUserId) {
  const taken = await prisma.inboxChannel.findFirst({
    where: {
      provider: INBOX_PROVIDERS.META_INSTAGRAM,
      externalId: igUserId,
      NOT: { id: channelId },
    },
    select: { id: true, name: true },
  });
  if (taken) throw conflict(`Esta conta já está conectada no canal ${taken.name}.`);
}

export async function connectInstagramAccount(channelId, account, actor) {
  const channel = await getInboxChannelRecord(channelId);
  if (channel.provider !== INBOX_PROVIDERS.META_INSTAGRAM) {
    throw validationError("Este canal não é do Instagram.");
  }
  await assertAccountAvailable(channel.id, account.igUserId);
  await subscribeInstagramPage(account.pageId, account.pageToken);
  const username = String(account.igUsername || "").replace(/^@/, "").trim();
  await prisma.inboxChannel.update({
    where: { id: channel.id },
    data: {
      apiKey: account.pageToken,
      externalId: account.igUserId,
      pageExternalId: account.pageId,
      phoneNumber: username ? `@${username}`.slice(0, 40) : null,
      connectionStatus: INBOX_CONNECTION_STATUSES.CONNECTED,
      connectionError: null,
    },
  });
  await prisma.appSetting.deleteMany({ where: { key: pendingKey(channel.id) } });
  if (actor?.id) {
    await writeAudit({
      userId: actor.id,
      action: "INBOX_CHANNEL_UPDATED",
      entity: "inbox_channel",
      entityId: channel.id,
      newData: { provider: channel.provider, instagram: username || account.igUserId, connected: true },
    });
  }
  return channel.id;
}

export async function completePendingInstagramAccount(channelId, igUserId, actor) {
  const pending = await readPending(channelId);
  const account = pending.find((item) => item.igUserId === String(igUserId));
  if (!account) throw notFound("Essa conta não está mais disponível. Conecte de novo.");
  await connectInstagramAccount(channelId, account, actor);
}

export async function clearInstagramConnection(channelId) {
  await prisma.appSetting.deleteMany({ where: { key: pendingKey(channelId) } });
}
