import { apiHandler } from "@/lib/api";
import { PERMISSIONS } from "@/lib/permissions";
import { validationError } from "@/lib/errors";
import { applyPriceImport, previewPriceImport } from "@/lib/services/import-prices";

export const POST = apiHandler(
  async (request, { session }) => {
    const form = await request.formData();
    const file = form.get("file");
    if (!file || typeof file !== "object" || !("arrayBuffer" in file)) {
      throw validationError("Selecione a planilha de preços (.xlsx).");
    }
    const name = String(file.name || "").toLowerCase();
    if (!name.endsWith(".xlsx") && !name.endsWith(".xls")) {
      throw validationError("Use uma planilha Excel (.xlsx).");
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    const apply = String(form.get("apply") || "").trim() === "1";
    if (apply) {
      return applyPriceImport(buffer, session);
    }
    const preview = await previewPriceImport(buffer);
    return { ...preview, message: "Conferência pronta. Confirme para gravar os novos preços." };
  },
  { permission: PERMISSIONS.PRICE_IMPORT },
);
