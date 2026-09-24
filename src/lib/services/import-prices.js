import ExcelJS from "exceljs";
import { prisma } from "../db";
import { writeAudit, writeMovement } from "../audit";
import { MOVEMENT_TYPES, PRICE_IMPORT_STATUSES } from "../constants";
import { validationError } from "../errors";
import { formatCurrency } from "../format";
import { movementUnitFields } from "./products";

const HEADER_ALIASES = {
  "referencia do fornecedor": "supplierModelCode",
  "referencia fornecedor": "supplierModelCode",
  "model code": "supplierModelCode",
  model_code: "supplierModelCode",
  modelcode: "supplierModelCode",
  "internet / valor mais 5%": "marketPrice",
  "internet / valor mais 5": "marketPrice",
  "preco de mercado": "marketPrice",
  "preco (22% desc.)": "installmentPrice",
  "preco (22% desc)": "installmentPrice",
  "preco parcelado": "installmentPrice",
  "valor a vista com 5% desconto": "cashPrice",
  "preco a vista": "cashPrice",
};

function cellText(value) {
  if (value == null || value === "") return "";
  if (typeof value === "object") {
    if (Array.isArray(value.richText)) {
      return value.richText.map((part) => part.text || "").join("").trim();
    }
    if (value.text) return String(value.text).trim();
    if (value.result != null) return cellText(value.result);
  }
  return String(value).trim();
}

function normalizeHeader(value) {
  return cellText(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeModelCode(value) {
  return cellText(value).replace(/\s+/g, " ").trim().toUpperCase();
}

function roundMoney(value) {
  return Math.round(Number(value) * 100) / 100;
}

function sameMoney(left, right) {
  return roundMoney(left || 0) === roundMoney(right || 0);
}

export function parseMoney(value) {
  if (value == null || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) return roundMoney(value);
  if (typeof value === "object") {
    if (typeof value.result === "number" && Number.isFinite(value.result)) return roundMoney(value.result);
    if (value.result != null) return parseMoney(value.result);
    if (Array.isArray(value.richText)) return parseMoney(value.richText.map((part) => part.text || "").join(""));
    if (value.text) return parseMoney(value.text);
  }
  let text = String(value).trim();
  if (!text) return null;
  text = text.replace(/r\$/gi, "").replace(/\s/g, "");
  if (!text) return null;
  if (text.includes(",") && text.includes(".")) {
    text = text.replace(/\./g, "").replace(",", ".");
  } else if (text.includes(",")) {
    text = text.replace(",", ".");
  }
  const parsed = Number(text);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return roundMoney(parsed);
}

function mapHeaderKey(value) {
  const normalized = normalizeHeader(value);
  if (!normalized) return null;
  if (HEADER_ALIASES[normalized]) return HEADER_ALIASES[normalized];

  if (normalized.includes("referencia") && normalized.includes("fornecedor")) return "supplierModelCode";
  if (normalized.includes("fornecedor") && (normalized.includes("ref.") || /(^| )ref( |$)/.test(normalized))) {
    return "supplierModelCode";
  }
  if (normalized.includes("model code") || normalized === "modelcode") return "supplierModelCode";

  if (normalized.includes("internet") || normalized.includes("valor mais 5") || normalized.includes("mercado")) {
    return "marketPrice";
  }
  if (normalized.includes("22%") || normalized.includes("22 %") || normalized.includes("parcelad")) {
    return "installmentPrice";
  }
  if (normalized.includes("vista")) return "cashPrice";
  return null;
}

function mapHeaderRow(row) {
  const columns = {};
  const mapped = new Set();
  row.eachCell((cell, col) => {
    const key = mapHeaderKey(cell.value);
    if (!key || mapped.has(key)) return;
    mapped.add(key);
    columns[col] = key;
  });
  return { columns, mapped };
}

function scoreHeader(mapped) {
  let score = mapped.size;
  if (mapped.has("supplierModelCode")) score += 10;
  if (mapped.has("cashPrice")) score += 3;
  if (mapped.has("installmentPrice")) score += 3;
  if (mapped.has("marketPrice")) score += 3;
  return score;
}

function findHeader(sheet) {
  const limit = Math.min(sheet.rowCount || 0, 25);
  let best = null;
  for (let rowNumber = 1; rowNumber <= limit; rowNumber += 1) {
    const { columns, mapped } = mapHeaderRow(sheet.getRow(rowNumber));
    if (!mapped.has("supplierModelCode")) continue;
    const priceCount = ["cashPrice", "installmentPrice", "marketPrice"].filter((key) => mapped.has(key)).length;
    if (priceCount < 2) continue;
    const score = scoreHeader(mapped);
    if (!best || score > best.score) {
      best = { headerRow: rowNumber, columns, mapped, score };
    }
  }
  return best;
}

function pickSheet(workbook) {
  let best = null;
  for (const sheet of workbook.worksheets) {
    const header = findHeader(sheet);
    if (!header) continue;
    const score = header.score * 1000 + (sheet.rowCount || 0);
    if (!best || score > best.score) {
      best = { sheet, ...header, score };
    }
  }
  return best;
}

function chunk(items, size) {
  const groups = [];
  for (let index = 0; index < items.length; index += size) {
    groups.push(items.slice(index, index + size));
  }
  return groups;
}

function priceObservation(current, next) {
  const parts = [];
  if (!sameMoney(current.cashPrice, next.cashPrice)) {
    parts.push(`à vista ${formatCurrency(current.cashPrice)} → ${formatCurrency(next.cashPrice)}`);
  }
  if (!sameMoney(current.installmentPrice, next.installmentPrice)) {
    parts.push(`parcelado ${formatCurrency(current.installmentPrice)} → ${formatCurrency(next.installmentPrice)}`);
  }
  if (!sameMoney(current.marketPrice, next.marketPrice)) {
    parts.push(`mercado ${formatCurrency(current.marketPrice)} → ${formatCurrency(next.marketPrice)}`);
  }
  return `Planilha Onyx: ${parts.join(" · ")}`;
}

async function parseWorkbook(buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const picked = pickSheet(workbook);
  if (!picked) {
    throw validationError(
      "Não encontrei as colunas da tabela Onyx. Preciso de Referência do Fornecedor e dos três preços.",
    );
  }

  const { sheet, headerRow, columns, mapped } = picked;
  const missingPrices = ["cashPrice", "installmentPrice", "marketPrice"].filter((key) => !mapped.has(key));
  if (missingPrices.length) {
    throw validationError("A planilha precisa das colunas de preço à vista, parcelado e de mercado.");
  }

  const rows = [];
  const invalid = [];
  const byCode = new Map();
  const duplicates = [];

  for (let rowNumber = headerRow + 1; rowNumber <= (sheet.rowCount || 0); rowNumber += 1) {
    const row = sheet.getRow(rowNumber);
    const raw = {};
    for (const [col, key] of Object.entries(columns)) {
      raw[key] = row.getCell(Number(col)).value;
    }
    const code = normalizeModelCode(raw.supplierModelCode);
    const cashPrice = parseMoney(raw.cashPrice);
    const installmentPrice = parseMoney(raw.installmentPrice);
    const marketPrice = parseMoney(raw.marketPrice);
    if (!code && cashPrice == null && installmentPrice == null && marketPrice == null) continue;

    if (!code) {
      invalid.push({ row: rowNumber, message: "Informe a Referência do Fornecedor (Model Code)." });
      continue;
    }
    if (cashPrice == null || installmentPrice == null || marketPrice == null) {
      invalid.push({ row: rowNumber, message: "Informe os três preços (à vista, parcelado e mercado)." });
      continue;
    }

    const entry = {
      row: rowNumber,
      supplierModelCode: code,
      cashPrice,
      installmentPrice,
      marketPrice,
    };
    rows.push(entry);
    if (byCode.has(code)) {
      duplicates.push({ supplierModelCode: code, rows: [byCode.get(code).row, rowNumber] });
    }
    byCode.set(code, entry);
  }

  if (!byCode.size) {
    throw validationError("A planilha não tem linhas de preço válidas.");
  }

  return {
    sheetName: sheet.name,
    headerRow,
    rows,
    byCode,
    invalid,
    duplicates,
  };
}

function serializeModel(model) {
  return {
    supplierModelCode: model.supplierModelCode,
    commercialName: model.commercialName,
    productCount: model.products.length,
    changeCount: model.changes.length,
    unchangedCount: model.unchanged,
    prices: model.prices,
    sample: model.changes.slice(0, 8).map((item) => ({
      id: item.id,
      serialOnyx: item.serialOnyx,
      status: item.status,
      unitName: item.unitName,
      from: {
        cashPrice: item.cashPrice,
        installmentPrice: item.installmentPrice,
        marketPrice: item.marketPrice,
      },
    })),
  };
}

async function buildPlan(buffer) {
  const parsed = await parseWorkbook(buffer);
  const products = await prisma.product.findMany({
    where: {
      deletedAt: null,
      status: { in: PRICE_IMPORT_STATUSES },
    },
    select: {
      id: true,
      serialOnyx: true,
      status: true,
      unitId: true,
      supplierModelCode: true,
      cashPrice: true,
      installmentPrice: true,
      marketPrice: true,
      catalogModel: { select: { supplierModelCode: true, commercialName: true } },
      unit: { select: { id: true, name: true } },
    },
  });

  const models = [];
  const missing = [];
  const changes = [];

  for (const entry of parsed.byCode.values()) {
    const matches = products.filter((product) => {
      const code = normalizeModelCode(product.supplierModelCode || product.catalogModel?.supplierModelCode);
      return code === entry.supplierModelCode;
    });
    if (!matches.length) {
      missing.push({ row: entry.row, supplierModelCode: entry.supplierModelCode });
      continue;
    }

    const changing = [];
    let unchanged = 0;
    for (const product of matches) {
      const next = {
        cashPrice: entry.cashPrice,
        installmentPrice: entry.installmentPrice,
        marketPrice: entry.marketPrice,
      };
      const changed =
        !sameMoney(product.cashPrice, next.cashPrice) ||
        !sameMoney(product.installmentPrice, next.installmentPrice) ||
        !sameMoney(product.marketPrice, next.marketPrice);
      if (!changed) {
        unchanged += 1;
        continue;
      }
      changing.push({
        ...product,
        unitName: product.unit?.name || null,
        next,
        observation: priceObservation(product, next),
      });
    }

    const commercialName =
      matches.find((item) => item.catalogModel?.commercialName)?.catalogModel?.commercialName || null;
    models.push({
      supplierModelCode: entry.supplierModelCode,
      commercialName,
      prices: {
        cashPrice: entry.cashPrice,
        installmentPrice: entry.installmentPrice,
        marketPrice: entry.marketPrice,
      },
      products: matches,
      changes: changing,
      unchanged,
    });
    changes.push(...changing);
  }

  const changingModels = models.filter((item) => item.changes.length);
  return {
    sheetName: parsed.sheetName,
    headerRow: parsed.headerRow,
    summary: {
      spreadsheetModels: parsed.byCode.size,
      matchedModels: models.length,
      missingModels: missing.length,
      invalidRows: parsed.invalid.length,
      duplicateModels: parsed.duplicates.length,
      productsToUpdate: changes.length,
      productsUnchanged: models.reduce((total, item) => total + item.unchanged, 0),
    },
    models: changingModels.map(serializeModel),
    unchangedModels: models
      .filter((item) => !item.changes.length)
      .slice(0, 30)
      .map((item) => ({
        supplierModelCode: item.supplierModelCode,
        commercialName: item.commercialName,
        productCount: item.products.length,
      })),
    missing: missing.slice(0, 80),
    invalid: parsed.invalid.slice(0, 80),
    duplicates: parsed.duplicates.slice(0, 40),
    changes,
  };
}

export async function previewPriceImport(buffer) {
  const plan = await buildPlan(buffer);
  return {
    sheetName: plan.sheetName,
    headerRow: plan.headerRow,
    summary: plan.summary,
    models: plan.models,
    unchangedModels: plan.unchangedModels,
    missing: plan.missing,
    invalid: plan.invalid,
    duplicates: plan.duplicates,
  };
}

export async function applyPriceImport(buffer, user) {
  const plan = await buildPlan(buffer);
  if (!plan.changes.length) {
    return {
      sheetName: plan.sheetName,
      headerRow: plan.headerRow,
      summary: plan.summary,
      models: plan.models,
      unchangedModels: plan.unchangedModels,
      missing: plan.missing,
      invalid: plan.invalid,
      duplicates: plan.duplicates,
      updatedCount: 0,
      message: "Nenhum aparelho precisava de atualização de preço.",
    };
  }

  const now = new Date();
  let updatedCount = 0;
  for (const group of chunk(plan.changes, 40)) {
    await prisma.$transaction(async (tx) => {
      for (const product of group) {
        await tx.product.update({
          where: { id: product.id },
          data: {
            cashPrice: product.next.cashPrice,
            installmentPrice: product.next.installmentPrice,
            marketPrice: product.next.marketPrice,
            lastPriceUpdateAt: now,
          },
        });
        await writeMovement(
          {
            productId: product.id,
            type: MOVEMENT_TYPES.PRICE_CHANGE,
            previousStatus: product.status,
            newStatus: product.status,
            observation: product.observation,
            origin: "Planilha Onyx",
            ...movementUnitFields(product),
            userId: user.id,
          },
          tx,
        );
        updatedCount += 1;
      }
    }, { timeout: 60000 });
  }

  await writeAudit({
    userId: user.id,
    action: "PRICE_IMPORT",
    entity: "product",
    entityId: user.id,
    newData: {
      sheetName: plan.sheetName,
      ...plan.summary,
      updatedCount,
    },
  });

  return {
    sheetName: plan.sheetName,
    headerRow: plan.headerRow,
    summary: { ...plan.summary, productsToUpdate: 0, productsUnchanged: plan.summary.productsUnchanged + updatedCount },
    models: [],
    unchangedModels: plan.unchangedModels,
    missing: plan.missing,
    invalid: plan.invalid,
    duplicates: plan.duplicates,
    updatedCount,
    message: `${updatedCount} aparelho(s) atualizado(s) com os preços da planilha.`,
  };
}
