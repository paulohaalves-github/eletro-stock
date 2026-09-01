import { apiHandler } from "@/lib/api";
import { PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/db";

export const GET = apiHandler(
  async (request) => {
    const { searchParams } = new URL(request.url);
    const page = Math.max(Number(searchParams.get("page") || 1), 1);
    const pageSize = 40;
    const [total, items] = await Promise.all([
      prisma.auditLog.count(),
      prisma.auditLog.findMany({
        include: { user: { select: { id: true, name: true, email: true } } },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return {
      items: items.map((item) => ({
        ...item,
        oldData: item.oldData ? JSON.parse(item.oldData) : null,
        newData: item.newData ? JSON.parse(item.newData) : null,
      })),
      total,
      page,
      pageSize,
    };
  },
  { permission: PERMISSIONS.AUDIT_VIEW },
);
