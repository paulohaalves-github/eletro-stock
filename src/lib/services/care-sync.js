import { prisma } from "../db";
import { ROLES } from "../constants";
import { getCareSettings, recordCareSyncRun } from "./settings";

const LOCK_KEY = "care.syncLock";
const LOCK_STALE_MS = 10 * 60 * 1000;
const TICK_MS = 60 * 1000;

async function readLock() {
  const row = await prisma.appSetting.findUnique({ where: { key: LOCK_KEY } });
  const lockedAt = Number(row?.value || 0);
  return { value: row?.value || "", lockedAt, held: Boolean(lockedAt) && Date.now() - lockedAt < LOCK_STALE_MS };
}

export async function acquireCareSyncLock() {
  const current = await readLock();
  if (current.held) return false;
  const value = String(Date.now());
  if (!current.value) {
    try {
      await prisma.appSetting.create({ data: { key: LOCK_KEY, value } });
      return true;
    } catch {
      return false;
    }
  }
  const updated = await prisma.appSetting.updateMany({
    where: { key: LOCK_KEY, value: current.value },
    data: { value },
  });
  return updated.count === 1;
}

export async function releaseCareSyncLock() {
  await prisma.appSetting.delete({ where: { key: LOCK_KEY } }).catch(() => {});
}

function touchCareSyncLock() {
  return prisma.appSetting.update({
    where: { key: LOCK_KEY },
    data: { value: String(Date.now()) },
  }).catch(() => {});
}

export function holdCareSyncLock() {
  const heartbeat = setInterval(() => { void touchCareSyncLock(); }, 60 * 1000);
  if (typeof heartbeat.unref === "function") heartbeat.unref();
  return () => clearInterval(heartbeat);
}

async function syncActor(unitId) {
  const admin = await prisma.user.findFirst({
    where: { active: true, role: ROLES.ADMIN },
    orderBy: { id: "asc" },
    select: { id: true, name: true, role: true },
  });
  if (!admin) throw new Error("Nenhum administrador ativo para sincronizar com o Care.");
  return { ...admin, activeUnitId: unitId, units: [{ id: unitId }] };
}

export async function executeCareSync(user) {
  const { collectCareFinalizedSales } = await import("./care");
  const { importCareSales, applyCareSaleDates, careOvsAwaitingProducts, careOvsNeedingSaleDate } = await import("./care-sales");
  const existing = await prisma.saleOrder.findMany({
    where: { ov: { not: null } },
    select: { ov: true },
  });
  const collected = await collectCareFinalizedSales((message) => {
    console.log(`[care-sync] ${message}`);
  }, { skipOvs: existing.map((item) => item.ov), refreshOvs: await careOvsNeedingSaleDate(), reopenOvs: await careOvsAwaitingProducts() });
  const imported = await importCareSales(collected.sales, user, (message) => {
    console.log(`[care-sync] ${message}`);
  });
  const datesUpdated = await applyCareSaleDates(collected.dateUpdates, (message) => {
    console.log(`[care-sync] ${message}`);
  });
  const importedCount = imported.imported?.length || 0;
  const skippedCount = (collected.skipped?.length || 0) + (imported.skipped?.length || 0);
  const message = `${importedCount} venda(s) importada(s). ${datesUpdated} data(s) de venda atualizada(s). ${skippedCount} ignorada(s).`;
  const lastRun = await recordCareSyncRun({ imported: importedCount, skipped: skippedCount, error: null, message });
  return { imported: importedCount, skipped: skippedCount, message, lastRun };
}

export async function runScheduledCareSync() {
  const settings = await getCareSettings();
  if (!settings.syncEnabled || !settings.syncUnitId) return { skipped: true };
  const lastAt = settings.lastRun?.at ? new Date(settings.lastRun.at).getTime() : 0;
  const intervalMs = settings.syncIntervalMinutes * 60 * 1000;
  if (lastAt && Date.now() - lastAt < intervalMs) return { skipped: true };
  if (!await acquireCareSyncLock()) return { skipped: true, message: "Já existe uma sincronização em andamento." };

  const stopHeartbeat = holdCareSyncLock();
  try {
    const unit = await prisma.unit.findFirst({
      where: { id: settings.syncUnitId, active: true },
      select: { id: true, name: true },
    });
    if (!unit) throw new Error("A unidade da sincronização automática não está ativa.");
    console.log(`[care-sync] Iniciando sincronização automática em ${unit.name}.`);
    return await executeCareSync(await syncActor(unit.id));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível sincronizar com o Care.";
    console.error("[care-sync]", error);
    await recordCareSyncRun({ imported: 0, skipped: 0, error: message, message });
    return { error: message };
  } finally {
    stopHeartbeat();
    await releaseCareSyncLock();
  }
}

export function startCareSyncScheduler() {
  if (globalThis.__careSyncTimer) return;
  const tick = () => {
    void runScheduledCareSync().catch((error) => console.error("[care-sync]", error));
  };
  const timer = setInterval(tick, TICK_MS);
  globalThis.__careSyncTimer = timer;
  if (typeof timer.unref === "function") timer.unref();
  setTimeout(tick, 20_000);
}
