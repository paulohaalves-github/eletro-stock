import ExcelJS from "exceljs";
import { prisma } from "../db";
import { CONDITIONS, CONDITION_LABELS } from "../constants";
import { createProduct } from "./products";
import { emptyToNull } from "../validations";
import { validationError } from "../errors";

export const IMPORT_COLUMNS = [
  "Serial Onyx",
  "Model Code",
  "Nome comercial",
  "EAN",
  "Categoria",
  "Linha",
  "Capacidade / Tamanho / Tipo",
  "Condição",
  "Descrição",
  "Descrição das avarias",
  "Preço à vista",
  "Preço parcelado",
  "Preço de mercado",
  "Origem",
  "Observação",
];

const HEADER_ALIASES = {
  "serial onyx": "serialOnyx",
  serial_onyx: "serialOnyx",
  serial: "serialOnyx",
  "model code": "supplierModelCode",
  model_code: "supplierModelCode",
  modelcode: "supplierModelCode",
  "nome comercial": "commercialName",
  nome_comercial: "commercialName",
  ean: "ean",
  categoria: "categoryName",
  linha: "lineName",
  "capacidade / tamanho / tipo": "capacitySizeType",
  capacidade: "capacitySizeType",
  condicao: "condition",
  descricao: "description",
  "descricao das avarias": "damageDescription",
  avarias: "damageDescription",
  "preco a vista": "cashPrice",
  "preco parcelado": "installmentPrice",
  "preco de mercado": "marketPrice",
  origem: "origin",
  observacao: "observation",
};

function cellText(value) {
  if (value == null || value === "") return "";
  if (typeof value === "object" && value.text) return String(value.text).trim();
  if (typeof value === "object" && value.result != null) return String(value.result).trim();
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

function mapCondition(value) {
  const text = normalizeHeader(value).replace(/ /g, "_");
  if (!text) return CONDITIONS.NEW;
  if (text.includes("avaria")) return CONDITIONS.NEW_DAMAGE;
  if (text.includes("revis")) return CONDITIONS.REVISED;
  if (text === "novo" || text === "new") return CONDITIONS.NEW;
  if (Object.values(CONDITIONS).includes(value)) return value;
  return null;
}

export async function buildImportTemplate() {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Eletro-Stock";
  const sheet = workbook.addWorksheet("Entrada");
  sheet.addRow(IMPORT_COLUMNS);
  sheet.getRow(1).font = { bold: true };
  sheet.addRow([
    "SN-EXEMPLO-001",
    "UN55AU7700",
    "Smart TV Samsung 55 Crystal UHD",
    "7892509110001",
    "Televisão",
    "Samsung",
    "55 polegadas 4K",
    "NOVO",
    "Unidade de exemplo",
    "",
    2499,
    2899,
    3299,
    "Planilha",
    "Entrada em lote",
  ]);
  sheet.columns.forEach((column) => {
    column.width = 24;
  });
  const help = workbook.addWorksheet("Instruções");
  help.addRow(["Instruções para entrada em lote"]);
  help.getRow(1).font = { bold: true };
  help.addRow(["Cada linha vira uma unidade individual no estoque."]);
  help.addRow(["Serial Onyx é obrigatório e não pode se repetir."]);
  help.addRow(["Nome comercial fica vinculado ao Model Code: unidades com o mesmo código compartilham o mesmo nome."]);
  help.addRow([`Condição: ${Object.values(CONDITION_LABELS).join(", ")} (ou NOVO, NOVO_COM_AVARIA, REVISADO).`]);
  help.addRow(["Categoria e Linha devem existir no sistema."]);
  help.addRow(["Novo com avaria exige a coluna Descrição das avarias."]);
  return workbook.xlsx.writeBuffer();
}

function mapHeaders(headerRow) {
  const map = {};
  headerRow.eachCell((cell, col) => {
    const key = HEADER_ALIASES[normalizeHeader(cell.value)];
    if (key) map[col] = key;
  });
  return map;
}

export async function importProductsFromWorkbook(buffer, user) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) throw validationError("A planilha está vazia.");

  const headerRow = sheet.getRow(1);
  const columns = mapHeaders(headerRow);
  if (!Object.values(columns).includes("serialOnyx")) {
    throw validationError("A planilha precisa da coluna Serial Onyx.");
  }

  const categories = await prisma.category.findMany();
  const lines = await prisma.line.findMany();
  const categoryByName = Object.fromEntries(categories.map((item) => [normalizeHeader(item.name), item]));
  const lineByName = Object.fromEntries(lines.map((item) => [normalizeHeader(item.name), item]));

  const seenSerials = new Set();
  const created = [];
  const errors = [];

  for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber += 1) {
    const row = sheet.getRow(rowNumber);
    const payload = {};
    for (const [col, key] of Object.entries(columns)) {
      payload[key] = cellText(row.getCell(Number(col)).value);
    }
    if (!Object.values(payload).some(Boolean)) continue;

    try {
      const serial = emptyToNull(payload.serialOnyx);
      if (!serial) throw new Error("Informe o Serial Onyx.");
      const serialKey = serial.toLowerCase();
      if (seenSerials.has(serialKey)) throw new Error("Serial Onyx duplicado na planilha.");
      seenSerials.add(serialKey);

      const condition = mapCondition(payload.condition);
      if (!condition) throw new Error("Condição inválida.");

      const category = categoryByName[normalizeHeader(payload.categoryName)];
      if (!category) throw new Error("Categoria não encontrada.");

      let lineId = null;
      if (emptyToNull(payload.lineName)) {
        const line = lineByName[normalizeHeader(payload.lineName)];
        if (!line) throw new Error("Linha não encontrada.");
        lineId = line.id;
      }

      const product = await createProduct(
        {
          serialOnyx: serial,
          supplierModelCode: payload.supplierModelCode,
          commercialName: payload.commercialName,
          ean: payload.ean,
          categoryId: category.id,
          lineId,
          capacitySizeType: payload.capacitySizeType,
          condition,
          description: payload.description,
          damageDescription: payload.damageDescription,
          cashPrice: payload.cashPrice,
          installmentPrice: payload.installmentPrice,
          marketPrice: payload.marketPrice,
          origin: payload.origin || "Planilha",
          observation: payload.observation || "Entrada via planilha",
        },
        user,
      );
      created.push({ row: rowNumber, id: product.id, serialOnyx: product.serialOnyx });
    } catch (error) {
      errors.push({ row: rowNumber, message: error.message || "Não foi possível importar esta linha." });
    }
  }

  return {
    createdCount: created.length,
    errorCount: errors.length,
    created,
    errors,
    message:
      created.length > 0
        ? `${created.length} produto(s) entrou(aram) no estoque.`
        : "Nenhum produto foi importado. Corrija as linhas com erro.",
  };
}
