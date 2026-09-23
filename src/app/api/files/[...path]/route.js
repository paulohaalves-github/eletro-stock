import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { apiHandler } from "@/lib/api";
import { can, PERMISSIONS } from "@/lib/permissions";
import { resolveUploadPath } from "@/lib/services/images";
import { forbidden, notFound } from "@/lib/errors";

const MIME = {
  ".webp": "image/webp",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".mp4": "video/mp4",
  ".3gp": "video/3gpp",
  ".mov": "video/quicktime",
  ".pdf": "application/pdf",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".txt": "text/plain",
  ".zip": "application/zip",
};

export const GET = apiHandler(
  async (_request, { params, session }) => {
    const { path: segments } = await params;
    const relative = (segments || []).join("/");
    const inboxFile = relative.startsWith("inbox/") || relative.startsWith("inbox-in/");
    if (inboxFile) {
      if (!can(session.role, PERMISSIONS.INBOX_VIEW)) throw forbidden();
    } else if (!can(session.role, PERMISSIONS.PRODUCT_VIEW) && !can(session.role, PERMISSIONS.REPAIR_VIEW)) {
      throw forbidden();
    }
    const full = resolveUploadPath(relative);
    try {
      await stat(full);
    } catch {
      throw notFound("Arquivo não encontrado.");
    }
    const bytes = await readFile(full);
    return new Response(bytes, {
      headers: {
        "Content-Type": MIME[path.extname(full).toLowerCase()] || "application/octet-stream",
        "Cache-Control": "private, max-age=31536000, immutable",
      },
    });
  },
);
