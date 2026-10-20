import { prisma } from "@/lib/db";
import { apiHandler } from "@/lib/api";
import { conflict, forbidden } from "@/lib/errors";
import { ndjsonStream } from "@/lib/ndjson-stream";
import { can, canManageAllSaleOrders, PERMISSIONS } from "@/lib/permissions";
import { collectCareFinalizedSales } from "@/lib/services/care";
import { importCareSales, applyCareSaleDates, careOvsAwaitingProducts, careOvsNeedingSaleDate } from "@/lib/services/care-sales";
import { acquireCareSyncLock, holdCareSyncLock, releaseCareSyncLock } from "@/lib/services/care-sync";
import { recordCareSyncRun } from "@/lib/services/settings";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export const POST = apiHandler(async (_request, { session }) => {
  if (!canManageAllSaleOrders(session.role) || !can(session.role, PERMISSIONS.SALE_CHECKOUT)) {
    throw forbidden("Somente o gestor ou o administrador pode sincronizar as vendas do Care.");
  }
  if (!await acquireCareSyncLock()) {
    throw conflict("Já existe uma sincronização com o Care em andamento.");
  }

  return ndjsonStream(async (send) => {
    const stopHeartbeat = holdCareSyncLock();
    try {
      send({
        type: "step",
        message: "Conectando ao Care.",
        progress: { phase: "list", current: 0, total: 0, label: "Conectando ao Care" },
      });
      const existing = await prisma.saleOrder.findMany({
        where: { ov: { not: null } },
        select: { ov: true },
      });
      const refreshOvs = await careOvsNeedingSaleDate();
      const report = (message, progress) => {
        send({ type: "step", message, progress: progress || null });
      };
      const collected = await collectCareFinalizedSales(report, {
        skipOvs: existing.map((item) => item.ov),
        refreshOvs,
        reopenOvs: await careOvsAwaitingProducts(),
      });
      const imported = await importCareSales(collected.sales, session, report);
      const datesUpdated = await applyCareSaleDates(collected.dateUpdates, report);
      const importedCount = imported.imported?.length || 0;
      const skippedCount = collected.skipped.length + imported.skipped.length;
      const message = `${importedCount} venda(s) importada(s). ${datesUpdated} data(s) de venda atualizada(s). ${skippedCount} ignorada(s).`;
      await recordCareSyncRun({ imported: importedCount, skipped: skippedCount, error: null, message });
      send({
        type: "done",
        result: {
          imported: imported.imported,
          skipped: [...collected.skipped, ...imported.skipped],
          warnings: imported.warnings,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Não foi possível sincronizar com o Care.";
      await recordCareSyncRun({ imported: 0, skipped: 0, error: message, message });
      throw error;
    } finally {
      stopHeartbeat();
      await releaseCareSyncLock();
    }
  }, { fallback: "Não foi possível sincronizar com o Care." });
});
