import ExcelJS from "exceljs";
import { prisma } from "../db";
import { CONDITION_LABELS, MOVEMENT_TYPE_LABELS, STATUS_LABELS } from "../constants";
import { formatCurrency, formatDateTime } from "../format";

function productWhere(filters = {}) {
  const where = {};
  if (filters.status) where.status = filters.status;
  if (filters.condition) where.condition = filters.condition;
  if (filters.categoryId) where.categoryId = Number(filters.categoryId);
  if (filters.from || filters.to) {
    where.entryDate = {};
    if (filters.from) where.entryDate.gte = new Date(filters.from);
    if (filters.to) {
      const end = new Date(filters.to);
      end.setHours(23, 59, 59, 999);
      where.entryDate.lte = end;
    }
  }
  return where;
}

export async function buildReport(type, filters = {}) {
  if (type === "movements") {
    const where = {};
    if (filters.from || filters.to) {
      where.createdAt = {};
      if (filters.from) where.createdAt.gte = new Date(filters.from);
      if (filters.to) {
        const end = new Date(filters.to);
        end.setHours(23, 59, 59, 999);
        where.createdAt.lte = end;
      }
    }
    if (filters.movementType) where.type = filters.movementType;
    const items = await prisma.stockMovement.findMany({
      where,
      include: {
        user: { select: { name: true } },
        product: { include: { category: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    return {
      title: "Histórico de movimentações",
      columns: ["Data", "Produto", "Serial", "Tipo", "Motivo", "Status anterior", "Status novo", "Usuário", "Observação"],
      rows: items.map((item) => [
        formatDateTime(item.createdAt),
        item.product ? `#${item.product.id}` : "—",
        item.product?.serialOnyx || "—",
        MOVEMENT_TYPE_LABELS[item.type] || item.type,
        item.reason || "—",
        STATUS_LABELS[item.previousStatus] || item.previousStatus || "—",
        STATUS_LABELS[item.newStatus] || item.newStatus || "—",
        item.user?.name || "—",
        item.observation || "—",
      ]),
    };
  }

  const where = productWhere(filters);
  if (type === "entries") {
    const items = await prisma.stockMovement.findMany({
      where: {
        type: "ENTRADA",
        ...(filters.from || filters.to
          ? {
              createdAt: {
                ...(filters.from ? { gte: new Date(filters.from) } : {}),
                ...(filters.to
                  ? { lte: (() => { const end = new Date(filters.to); end.setHours(23, 59, 59, 999); return end; })() }
                  : {}),
              },
            }
          : {}),
      },
      include: { product: { include: { category: true, line: true } }, user: true },
      orderBy: { createdAt: "desc" },
    });
    return {
      title: "Entradas por período",
      columns: ["Data", "ID", "Serial Onyx", "Categoria", "Model Code", "Condição", "Status", "Usuário"],
      rows: items.map((item) => [
        formatDateTime(item.createdAt),
        item.product?.id,
        item.product?.serialOnyx || "—",
        item.product?.category?.name || "—",
        item.product?.supplierModelCode || "—",
        CONDITION_LABELS[item.product?.condition] || item.product?.condition,
        STATUS_LABELS[item.product?.status] || item.product?.status,
        item.user?.name,
      ]),
    };
  }

  if (type === "exits") {
    const items = await prisma.stockMovement.findMany({
      where: {
        type: { in: ["SAIDA", "TRANSFERENCIA"] },
        ...(filters.from || filters.to
          ? {
              createdAt: {
                ...(filters.from ? { gte: new Date(filters.from) } : {}),
                ...(filters.to
                  ? { lte: (() => { const end = new Date(filters.to); end.setHours(23, 59, 59, 999); return end; })() }
                  : {}),
              },
            }
          : {}),
      },
      include: { product: { include: { category: true } }, user: true },
      orderBy: { createdAt: "desc" },
    });
    return {
      title: "Saídas por período",
      columns: ["Data", "ID", "Serial Onyx", "Motivo", "Status", "Usuário", "Observação"],
      rows: items.map((item) => [
        formatDateTime(item.createdAt),
        item.product?.id,
        item.product?.serialOnyx || "—",
        item.reason || "—",
        STATUS_LABELS[item.newStatus] || item.newStatus,
        item.user?.name,
        item.observation || "—",
      ]),
    };
  }

  const extraWhere =
    type === "sold"
      ? { ...where, status: "VENDIDO" }
      : type === "stock"
        ? { ...where, status: { in: ["DISPONIVEL", "RESERVADO"] } }
        : where;

  const products = await prisma.product.findMany({
    where: extraWhere,
    include: { category: true, line: true, catalogModel: true },
    orderBy: { id: "asc" },
  });

  const titles = {
    stock: "Estoque atual",
    sold: "Produtos vendidos",
    condition: "Produtos por condição",
    category: "Produtos por categoria",
    value: "Valor total do estoque",
  };

  return {
    title: titles[type] || "Relatório de produtos",
    columns: [
      "ID",
      "Serial Onyx",
      "Categoria",
      "Linha",
      "Model Code",
      "Nome comercial",
      "EAN",
      "Capacidade",
      "Condição",
      "Status",
      "À vista",
      "Parcelado",
      "Mercado",
      "Entrada",
    ],
    rows: products.map((item) => [
      item.id,
      item.serialOnyx || "—",
      item.category?.name || "—",
      item.line?.name || "—",
      item.supplierModelCode || "—",
      item.catalogModel?.commercialName || "—",
      item.ean || "—",
      item.capacitySizeType || "—",
      CONDITION_LABELS[item.condition] || item.condition,
      STATUS_LABELS[item.status] || item.status,
      formatCurrency(item.cashPrice),
      formatCurrency(item.installmentPrice),
      formatCurrency(item.marketPrice),
      formatDateTime(item.entryDate),
    ]),
    summary:
      type === "value"
        ? {
            cash: products.reduce((sum, item) => sum + (item.cashPrice || 0), 0),
            installment: products.reduce((sum, item) => sum + (item.installmentPrice || 0), 0),
            market: products.reduce((sum, item) => sum + (item.marketPrice || 0), 0),
            count: products.length,
          }
        : null,
  };
}

export function toCsv(report) {
  const lines = [report.columns.join(";"), ...report.rows.map((row) => row.map((cell) => `"${String(cell ?? "").replaceAll('"', '""')}"`).join(";"))];
  return lines.join("\n");
}

export async function toExcelBuffer(report) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Eletro-Stock";
  const sheet = workbook.addWorksheet(report.title.slice(0, 31));
  sheet.addRow(report.columns);
  sheet.getRow(1).font = { bold: true };
  for (const row of report.rows) sheet.addRow(row);
  sheet.columns.forEach((column) => {
    column.width = 18;
  });
  return workbook.xlsx.writeBuffer();
}
