import { apiHandler } from "@/lib/api";
import { PERMISSIONS } from "@/lib/permissions";
import { buildReport, toCsv, toExcelBuffer } from "@/lib/services/reports";

export const GET = apiHandler(
  async (request) => {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") || "stock";
    const format = searchParams.get("format") || "json";
    const filters = Object.fromEntries(searchParams.entries());
    const report = await buildReport(type, filters);

    if (format === "csv") {
      const csv = `\uFEFF${toCsv(report)}`;
      return new Response(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${type}.csv"`,
        },
      });
    }

    if (format === "xlsx") {
      const buffer = await toExcelBuffer(report);
      return new Response(buffer, {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="${type}.xlsx"`,
        },
      });
    }

    return report;
  },
  { permission: PERMISSIONS.REPORT_VIEW },
);
