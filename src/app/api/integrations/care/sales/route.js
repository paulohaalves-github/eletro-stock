import { prisma } from "@/lib/db";
import { apiHandler } from "@/lib/api";
import { forbidden } from "@/lib/errors";
import { ndjsonStream } from "@/lib/ndjson-stream";
import { can, canManageAllSaleOrders, PERMISSIONS } from "@/lib/permissions";
import { collectCareFinalizedSales } from "@/lib/services/care";
import { importCareSales } from "@/lib/services/care-sales";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export const POST = apiHandler(async (_request, { session }) => {
  if (!canManageAllSaleOrders(session.role) || !can(session.role, PERMISSIONS.SALE_CHECKOUT)) {
    throw forbidden("Somente o gestor ou o administrador pode sincronizar as vendas do Care.");
  }

  return ndjsonStream(async (send) => {
    send({
      type: "step",
      message: "Conectando ao Care.",
      progress: { phase: "list", current: 0, total: 0, label: "Conectando ao Care" },
    });
    const existing = await prisma.saleOrder.findMany({
      where: { ov: { not: null } },
      select: { ov: true },
    });
    const report = (message, progress) => {
      send({ type: "step", message, progress: progress || null });
    };
    const collected = await collectCareFinalizedSales(report, {
      skipOvs: existing.map((item) => item.ov),
    });
    const imported = await importCareSales(collected.sales, session, report);
    send({
      type: "done",
      result: {
        imported: imported.imported,
        skipped: [...collected.skipped, ...imported.skipped],
        warnings: imported.warnings,
      },
    });
  }, { fallback: "Não foi possível sincronizar com o Care." });
});
