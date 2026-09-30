import { prisma } from "@/lib/db";
import { apiHandler } from "@/lib/api";
import { AppError, forbidden } from "@/lib/errors";
import { can, canManageAllSaleOrders, PERMISSIONS } from "@/lib/permissions";
import { collectCareFinalizedSales } from "@/lib/services/care";
import { importCareSales } from "@/lib/services/care-sales";

export const maxDuration = 300;

export const POST = apiHandler(async (_request, { session }) => {
  if (!canManageAllSaleOrders(session.role) || !can(session.role, PERMISSIONS.SALE_CHECKOUT)) {
    throw forbidden("Somente o gestor ou o administrador pode sincronizar as vendas do Care.");
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (payload) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(payload)}\n`));
      };
      try {
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
      } catch (error) {
        if (!(error instanceof AppError)) console.error(error);
        const message = error instanceof AppError
          ? error.message
          : "Não foi possível sincronizar com o Care.";
        send({ type: "error", message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
    },
  });
});
