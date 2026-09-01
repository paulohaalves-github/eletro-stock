import { apiHandler } from "@/lib/api";
import { PERMISSIONS } from "@/lib/permissions";
import { importProductsFromWorkbook } from "@/lib/services/import-products";
import { validationError } from "@/lib/errors";

export const POST = apiHandler(
  async (request, { session }) => {
    const form = await request.formData();
    const file = form.get("file");
    if (!file || typeof file !== "object" || !("arrayBuffer" in file)) {
      throw validationError("Selecione uma planilha .xlsx.");
    }
    const name = String(file.name || "").toLowerCase();
    if (!name.endsWith(".xlsx") && !name.endsWith(".xls")) {
      throw validationError("Use uma planilha Excel (.xlsx).");
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    return importProductsFromWorkbook(buffer, session);
  },
  { permission: PERMISSIONS.STOCK_ENTRY },
);
