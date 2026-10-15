/**
 * Devolve ao estoque o produto que ficou Vendido depois da exclusão da VD-000040.
 *
 * Conferência, sem gravar:
 *   node --env-file=.env scripts/restore-deleted-sale.mjs
 *
 * Aplicar em produção:
 *   node --env-file=.env scripts/restore-deleted-sale.mjs --apply
 */
import { PrismaClient } from "@prisma/client";

const PRODUCT_ID = 252;
const SERIAL_ONYX = "ON021815";
const SALE_NUMBER = "VD-000040";
const CLOSED_WORK_ORDERS = ["ENTREGUE", "SEM_REPARO", "CANCELADA"];

const apply = process.argv.includes("--apply");
const prisma = new PrismaClient();

function stop(message) {
  console.error(message);
  process.exitCode = 1;
}

const product = await prisma.product.findUnique({
  where: { id: PRODUCT_ID },
  select: { id: true, serialOnyx: true, status: true, unitId: true, locationId: true, createdById: true },
});

if (!product) {
  stop(`Produto ${PRODUCT_ID} não encontrado.`);
} else if (product.serialOnyx !== SERIAL_ONYX) {
  stop(`O produto ${PRODUCT_ID} é ${product.serialOnyx}, não ${SERIAL_ONYX}. Nada foi alterado.`);
} else {
  const saleOrder = await prisma.saleOrder.findUnique({
    where: { number: SALE_NUMBER },
    select: { id: true, number: true, status: true },
  });
  const sales = await prisma.sale.findMany({
    where: { productId: product.id },
    orderBy: { soldAt: "desc" },
  });
  const named = sales.filter((sale) => String(sale.observation || "").includes(SALE_NUMBER));
  const sale = named.length === 1 ? named[0] : (sales.length === 1 ? sales[0] : null);

  console.log(JSON.stringify({
    product: { id: product.id, serialOnyx: product.serialOnyx, status: product.status },
    saleOrder,
    sales: sales.map((row) => ({
      id: row.id,
      cashPrice: row.cashPrice,
      invoiceNumber: row.invoiceNumber,
      soldAt: row.soldAt,
      observation: row.observation,
    })),
  }, null, 2));

  if (saleOrder) {
    stop(`${SALE_NUMBER} ainda existe. Exclua essa venda pela tela. Nada foi alterado.`);
  } else if (sales.length > 1 && named.length !== 1) {
    stop(`Há ${sales.length} vendas no produto e nenhuma identifica ${SALE_NUMBER} com segurança. Nada foi alterado.`);
  } else if (product.status !== "VENDIDO" && !sale) {
    console.log("O produto já não está vendido e não há baixa para remover.");
  } else if (sale) {
    const workOrders = await prisma.workOrder.findMany({
      where: {
        OR: [
          { saleId: sale.id },
          { productId: product.id, status: { notIn: CLOSED_WORK_ORDERS } },
        ],
      },
      select: { id: true, number: true, status: true, saleId: true },
    });
    const linkedItems = await prisma.saleOrderItem.findMany({
      where: { saleId: sale.id },
      select: { id: true, saleOrder: { select: { number: true } } },
    });
    if (workOrders.length) {
      stop(`Há ordem de serviço ligada a esta baixa: ${workOrders.map((row) => row.number).join(", ")}. Nada foi alterado.`);
    } else if (linkedItems.length) {
      stop(`A baixa ainda está na venda ${linkedItems.map((row) => row.saleOrder?.number).filter(Boolean).join(", ")}. Nada foi alterado.`);
    } else if (!apply) {
      console.log("Conferência concluída. Rode novamente com --apply para gravar.");
    } else {
      await prisma.$transaction(async (tx) => {
        if (product.status === "VENDIDO") {
          await tx.product.update({
            where: { id: product.id },
            data: { status: "DISPONIVEL" },
          });
          await tx.stockMovement.create({
            data: {
              productId: product.id,
              type: "ALTERACAO",
              previousStatus: "VENDIDO",
              newStatus: "DISPONIVEL",
              observation: `Disponível após exclusão da venda ${SALE_NUMBER}. Correção do produto que permaneceu vendido.`,
              previousLocationId: product.locationId,
              newLocationId: product.locationId,
              previousUnitId: product.unitId,
              newUnitId: product.unitId,
              userId: sale.createdById,
            },
          });
        }
        await tx.sale.delete({ where: { id: sale.id } });
        await tx.auditLog.create({
          data: {
            userId: sale.createdById,
            action: "SALE_REVERSED",
            entity: "product",
            entityId: product.id,
            oldData: JSON.stringify({
              status: product.status,
              saleId: sale.id,
              cashPrice: sale.cashPrice,
              invoiceNumber: sale.invoiceNumber,
              saleNumber: SALE_NUMBER,
            }),
            newData: JSON.stringify({ status: product.status === "VENDIDO" ? "DISPONIVEL" : product.status }),
          },
        });
      });
      console.log(`Produto ${product.id} voltou para DISPONIVEL e a baixa ${sale.id} foi removida.`);
    }
  } else if (!apply) {
    console.log("Não há registro de baixa. A conferência só devolveria o status para DISPONIVEL. Rode com --apply para gravar.");
  } else {
    const openRepair = await prisma.workOrder.findFirst({
      where: { productId: product.id, status: { notIn: CLOSED_WORK_ORDERS } },
      select: { number: true },
    });
    if (openRepair) {
      stop(`A ordem de serviço ${openRepair.number} está aberta neste produto. Nada foi alterado.`);
    } else {
      await prisma.$transaction(async (tx) => {
        await tx.product.update({
          where: { id: product.id },
          data: { status: "DISPONIVEL" },
        });
        await tx.stockMovement.create({
          data: {
            productId: product.id,
            type: "ALTERACAO",
            previousStatus: "VENDIDO",
            newStatus: "DISPONIVEL",
            observation: `Disponível após exclusão da venda ${SALE_NUMBER}. Correção do produto que permaneceu vendido.`,
            previousLocationId: product.locationId,
            newLocationId: product.locationId,
            previousUnitId: product.unitId,
            newUnitId: product.unitId,
            userId: product.createdById,
          },
        });
        await tx.auditLog.create({
          data: {
            userId: product.createdById,
            action: "SALE_REVERSED",
            entity: "product",
            entityId: product.id,
            oldData: JSON.stringify({ status: "VENDIDO", saleNumber: SALE_NUMBER }),
            newData: JSON.stringify({ status: "DISPONIVEL" }),
          },
        });
      });
      console.log(`Produto ${product.id} voltou para DISPONIVEL. Não havia registro de baixa para remover.`);
    }
  }
}

await prisma.$disconnect();
