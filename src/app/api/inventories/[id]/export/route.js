import { apiHandler } from "@/lib/api";
import { exportInventoryWorkbook } from "@/lib/services/inventories";

export const GET = apiHandler(async (_request, { params, session }) => {
  const { id } = await params;
  const { filename, buffer } = await exportInventoryWorkbook(id, session);
  return new Response(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
});
