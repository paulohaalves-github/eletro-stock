import { prisma } from "../db";
import { validationError } from "../errors";
import { writeAudit } from "../audit";

const CARE_KEYS = {
  user: "care.user",
  password: "care.password",
  clienteId: "care.clienteId",
  clienteConfigId: "care.clienteConfigId",
};

const CATALOG_KEYS = {
  online: "catalog.online",
  offlineMessage: "catalog.offlineMessage",
  pickupNote: "catalog.pickupNote",
  payCash: "catalog.payCash",
  payCard: "catalog.payCard",
  payPix: "catalog.payPix",
};

const CATALOG_DEFAULTS = {
  online: true,
  offlineMessage: "Catálogo temporariamente indisponível.",
  pickupNote: "Todos os produtos adquiridos deverão ser retirados pelo comprador, ou por pessoa por ele autorizada, no prazo máximo de até 5 (cinco) dias úteis contados a partir da data da compra. Embora todos os itens sejam devidamente embalados para transporte, o deslocamento, o manuseio e eventuais danos ocorridos após a retirada são de inteira responsabilidade do cliente.",
  payCash: true,
  payCard: true,
  payPix: true,
};

function stored(rows, key) {
  return rows.find((row) => row.key === key)?.value;
}

export async function getCareSettings() {
  const rows = await prisma.appSetting.findMany({
    where: { key: { in: Object.values(CARE_KEYS) } },
  });
  const password = stored(rows, CARE_KEYS.password) ?? process.env.CARE_PASSWORD ?? "";
  return {
    user: stored(rows, CARE_KEYS.user) ?? process.env.CARE_USER ?? "",
    password,
    clienteId: stored(rows, CARE_KEYS.clienteId) ?? process.env.CARE_CLIENTE_ID ?? "116",
    clienteConfigId: stored(rows, CARE_KEYS.clienteConfigId) ?? process.env.CARE_CLIENTECONFIG_ID ?? "249",
    passwordSet: Boolean(String(password).trim()),
  };
}

export function publicCareSettings(settings) {
  return {
    user: settings.user,
    clienteId: settings.clienteId,
    clienteConfigId: settings.clienteConfigId,
    passwordSet: settings.passwordSet,
  };
}

export async function saveCareSettings(payload, actor) {
  const current = await getCareSettings();
  const user = String(payload.user || "").trim();
  const clienteId = String(payload.clienteId || "").trim();
  const clienteConfigId = String(payload.clienteConfigId || "").trim();
  const typedPassword = String(payload.password || "");
  const password = typedPassword || current.password;

  if (!user || !user.includes("@")) throw validationError("Informe o e-mail de acesso ao Care.");
  if (!password) throw validationError("Informe a senha de acesso ao Care.");
  if (!/^\d+$/.test(clienteId)) throw validationError("Informe o cliente ID do Care, somente números.");
  if (!/^\d+$/.test(clienteConfigId)) throw validationError("Informe o cliente config ID do Care, somente números.");

  const values = {
    [CARE_KEYS.user]: user,
    [CARE_KEYS.password]: password,
    [CARE_KEYS.clienteId]: clienteId,
    [CARE_KEYS.clienteConfigId]: clienteConfigId,
  };

  await prisma.$transaction(
    Object.entries(values).map(([key, value]) =>
      prisma.appSetting.upsert({
        where: { key },
        create: { key, value },
        update: { value },
      }),
    ),
  );

  await writeAudit({
    userId: actor.id,
    action: "CARE_SETTINGS_UPDATED",
    entity: "settings",
    entityId: 0,
    newData: { user, clienteId, clienteConfigId, passwordChanged: Boolean(typedPassword) },
  });

  return publicCareSettings({ user, clienteId, clienteConfigId, passwordSet: true });
}

function readFlag(value, fallback) {
  if (value == null || value === "") return fallback;
  return value === "true" || value === "1";
}

function readTextSetting(value, fallback, max) {
  const text = value == null ? fallback : String(value);
  return text.slice(0, max);
}

export async function getCatalogSettings() {
  const rows = await prisma.appSetting.findMany({
    where: { key: { in: Object.values(CATALOG_KEYS) } },
  });
  return {
    online: readFlag(stored(rows, CATALOG_KEYS.online), CATALOG_DEFAULTS.online),
    offlineMessage: readTextSetting(stored(rows, CATALOG_KEYS.offlineMessage), CATALOG_DEFAULTS.offlineMessage, 500),
    pickupNote: readTextSetting(stored(rows, CATALOG_KEYS.pickupNote), CATALOG_DEFAULTS.pickupNote, 1000),
    payCash: readFlag(stored(rows, CATALOG_KEYS.payCash), CATALOG_DEFAULTS.payCash),
    payCard: readFlag(stored(rows, CATALOG_KEYS.payCard), CATALOG_DEFAULTS.payCard),
    payPix: readFlag(stored(rows, CATALOG_KEYS.payPix), CATALOG_DEFAULTS.payPix),
  };
}

function readCatalogText(value, label, max) {
  const text = String(value ?? "").trim();
  if (text.length > max) throw validationError(`${label} deve ter no máximo ${max} caracteres.`);
  return text;
}

export async function saveCatalogSettings(payload, actor) {
  const online = Boolean(payload.online);
  const offlineMessage = readCatalogText(payload.offlineMessage, "A mensagem de catálogo fora do ar", 500);
  const pickupNote = readCatalogText(payload.pickupNote, "O texto de retirada", 1000);
  const payCash = Boolean(payload.payCash);
  const payCard = Boolean(payload.payCard);
  const payPix = Boolean(payload.payPix);

  if (!online && !offlineMessage) {
    throw validationError("Informe a mensagem exibida quando o catálogo estiver fora do ar.");
  }

  const settings = { online, offlineMessage, pickupNote, payCash, payCard, payPix };
  const values = {
    [CATALOG_KEYS.online]: online ? "true" : "false",
    [CATALOG_KEYS.offlineMessage]: offlineMessage,
    [CATALOG_KEYS.pickupNote]: pickupNote,
    [CATALOG_KEYS.payCash]: payCash ? "true" : "false",
    [CATALOG_KEYS.payCard]: payCard ? "true" : "false",
    [CATALOG_KEYS.payPix]: payPix ? "true" : "false",
  };

  await prisma.$transaction(
    Object.entries(values).map(([key, value]) =>
      prisma.appSetting.upsert({
        where: { key },
        create: { key, value },
        update: { value },
      }),
    ),
  );

  await writeAudit({
    userId: actor.id,
    action: "CATALOG_SETTINGS_UPDATED",
    entity: "settings",
    entityId: 0,
    newData: settings,
  });

  return settings;
}

const ICECAT_KEYS = {
  username: "icecat.username",
  apiToken: "icecat.apiToken",
};

export async function getIcecatSettings() {
  const rows = await prisma.appSetting.findMany({
    where: { key: { in: Object.values(ICECAT_KEYS) } },
  });
  const username = (stored(rows, ICECAT_KEYS.username) ?? process.env.ICECAT_USERNAME ?? "").trim();
  const apiToken = (stored(rows, ICECAT_KEYS.apiToken) ?? process.env.ICECAT_API_TOKEN ?? "").trim();
  const tokenSet = Boolean(apiToken);
  return {
    username,
    apiToken,
    tokenSet,
    configured: Boolean(username && tokenSet),
  };
}

export function publicIcecatSettings(settings) {
  return {
    username: settings.username,
    tokenSet: settings.tokenSet,
    configured: settings.configured,
  };
}

export async function saveIcecatSettings(payload, actor) {
  const current = await getIcecatSettings();
  const username = String(payload.username || "").trim();
  const typedToken = String(payload.apiToken || "").trim();
  let apiToken = typedToken || current.apiToken;

  if (!username) {
    if (typedToken) throw validationError("Informe o usuário do Icecat.");
    apiToken = "";
  } else if (username.length > 190) {
    throw validationError("O usuário do Icecat deve ter no máximo 190 caracteres.");
  } else if (!apiToken) {
    throw validationError("Informe a chave de acesso do Icecat.");
  } else if (apiToken.length > 500) {
    throw validationError("A chave de acesso do Icecat deve ter no máximo 500 caracteres.");
  }

  const values = {
    [ICECAT_KEYS.username]: username,
    [ICECAT_KEYS.apiToken]: apiToken,
  };

  await prisma.$transaction(
    Object.entries(values).map(([key, value]) =>
      prisma.appSetting.upsert({
        where: { key },
        create: { key, value },
        update: { value },
      }),
    ),
  );

  await writeAudit({
    userId: actor.id,
    action: "ICECAT_SETTINGS_UPDATED",
    entity: "settings",
    entityId: 0,
    newData: { username, tokenChanged: Boolean(typedToken), configured: Boolean(username && apiToken) },
  });

  return publicIcecatSettings({
    username,
    tokenSet: Boolean(apiToken),
    configured: Boolean(username && apiToken),
  });
}
