import { apiHandler } from "@/lib/api";
import { PERMISSIONS } from "@/lib/permissions";
import { buildImportTemplate } from "@/lib/services/import-products";

export const GET = apiHandler(
  async () => {
    const buffer = await buildImportTemplate();
    return new Response(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="eletro-stock-entrada.xlsx"',
      },
    });
  },
  { permission: PERMISSIONS.STOCK_ENTRY },
);
