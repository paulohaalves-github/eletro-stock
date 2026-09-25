import { prisma } from "../db";
import { validationError } from "../errors";
import { writeAudit } from "../audit";

const CARE_KEYS = {
  user: "care.user",
  password: "care.password",
  clienteId: "care.clienteId",
  clienteConfigId: "care.clienteConfigId",
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
